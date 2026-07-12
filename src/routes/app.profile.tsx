import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { cn } from "@/lib/utils";
import bloggerAvatar from "@/assets/blogger-avatar.jpg";
import {
  getCurrentProfile,
  updateCurrentPassword,
  updateCurrentProfile,
  type AuthProfile,
} from "@/integrations/supabase/auth";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/dict";
import { translateAppPhrase } from "@/i18n/app-text";
import { STATUS_NOTE_MAX, buildStatusNoteExpiry, getStatusNoteDurationOptions, type StatusNoteDuration } from "@/lib/status-note";

type Status = "available" | "vacation" | "busy" | "offline";

const STATUS_COLOR: Record<Status, string> = {
  available: "bg-[var(--brand-rose)]",
  vacation: "bg-[var(--brand-magenta)]",
  busy: "bg-foreground/60",
  offline: "bg-slate-400",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/app/profile")({
  ssr: false,
  loader: async () => {
    try {
      return {
        profile: await getCurrentProfile(),
      };
    } catch {
      return {
        profile: null as AuthProfile | null,
      };
    }
  },
  component: ProfilePage,
});

function ProfilePage() {
  const uiLang = useLang();
  const tr = (value: string) => translateAppPhrase(value, uiLang);
  const statusLabel: Record<Status, string> = {
    available: tr("Active"),
    vacation: tr("On vacation"),
    busy: tr("Busy"),
    offline: tr("Offline"),
  };
  const initialData = Route.useLoaderData();
  const initialProfile = initialData.profile;
  const [profile, setProfile] = useState<AuthProfile | null>(initialProfile);
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSaveMessage, setNoteSaveMessage] = useState("");
  const [photo, setPhoto] = useState(getSafeAvatarUrl(initialProfile?.avatar_url));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState(initialProfile?.display_name || initialProfile?.full_name || "");
  const [avatarName, setAvatarName] = useState(initialProfile?.sl_avatar_name || "");
  const [avatarUuid, setAvatarUuid] = useState(initialProfile?.sl_avatar_uuid || "");
  const [language, setLanguage] = useState<"en" | "es">(initialProfile?.language_preference || "en");
  const [flickr, setFlickr] = useState(initialProfile?.flickr_url || "");
  const [instagram, setInstagram] = useState(initialProfile?.instagram_url || "");
  const [facebook, setFacebook] = useState(initialProfile?.facebook_url || "");
  const [blogUrl, setBlogUrl] = useState(initialProfile?.blog_url || "");
  const [note, setNote] = useState(initialProfile?.status_message || "");
  const [noteDuration, setNoteDuration] = useState<StatusNoteDuration>(initialProfile?.status_message_duration ?? "none");
  const [status, setStatus] = useState<Status>((initialProfile?.availability_status as Status) || "available");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const hasProfileChanges =
    (displayName.trim() || "") !== (initialProfile?.display_name || initialProfile?.full_name || "") ||
    avatarUuid.trim() !== (initialProfile?.sl_avatar_uuid || "") ||
    language !== (initialProfile?.language_preference || "en") ||
    flickr.trim() !== (initialProfile?.flickr_url || "") ||
    instagram.trim() !== (initialProfile?.instagram_url || "") ||
    facebook.trim() !== (initialProfile?.facebook_url || "") ||
    blogUrl.trim() !== (initialProfile?.blog_url || "") ||
    status !== ((initialProfile?.availability_status as Status) || "available") ||
    Boolean(photoFile);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhoto(URL.createObjectURL(file));
  };

  const onNoteChange = (value: string) => {
    const lines = value.split("\n").slice(0, 2);
    setNote(lines.join("\n").slice(0, STATUS_NOTE_MAX));
  };

  async function uploadAvatarIfNeeded() {
    if (!photoFile || !profile?.id) return null;
    const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${profile.id}/${Date.now()}-avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(filePath, photoFile, {
      upsert: true,
      contentType: photoFile.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function onSaveProfile() {
    if (!profile) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      const cleanAvatarUuid = avatarUuid.trim();
      if (cleanAvatarUuid && !UUID_RE.test(cleanAvatarUuid)) {
        setSaveMessage("SL UUID format looks invalid. Use full UUID (8-4-4-4-12).");
        return;
      }

      const uploadedAvatar = await uploadAvatarIfNeeded();
      const existingAvatar = profile.avatar_url?.startsWith("blob:") ? null : profile.avatar_url;
      const updated = await updateCurrentProfile({
        display_name: displayName.trim() || null,
        sl_avatar_uuid: cleanAvatarUuid || null,
        avatar_url: uploadedAvatar ?? existingAvatar,
        availability_status: status,
        status_message: note.trim() || null,
        status_message_expires_at: note.trim() ? buildStatusNoteExpiry(noteDuration) : null,
        status_message_duration: note.trim() && noteDuration !== "none" ? noteDuration : null,
        language_preference: language,
        flickr_url: flickr.trim() || null,
        instagram_url: instagram.trim() || null,
        facebook_url: facebook.trim() || null,
        blog_url: blogUrl.trim() || null,
      });
      setProfile(updated);
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: updated }));
      setPhoto(getSafeAvatarUrl(updated.avatar_url));
      setPhotoFile(null);
      setSaveMessage(tr("Profile saved."));
      window.setTimeout(() => setSaveMessage(""), 2600);
    } catch (error) {
      console.error("[Profile] save failed", error);
      setSaveMessage(error instanceof Error ? error.message : tr("Could not save profile."));
    } finally {
      setIsSaving(false);
    }
  }

  async function onSaveNote() {
    if (!profile) return;
    setIsSavingNote(true);
    setNoteSaveMessage("");
    try {
      const updated = await updateCurrentProfile({
        status_message: note.trim() || null,
        status_message_expires_at: note.trim() ? buildStatusNoteExpiry(noteDuration) : null,
        status_message_duration: note.trim() && noteDuration !== "none" ? noteDuration : null,
      });
      const freshProfile = (await getCurrentProfile(updated.id)) ?? updated;
      setProfile(freshProfile);
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: freshProfile }));
      setNoteSaveMessage(tr("Note saved."));
      window.setTimeout(() => setNoteSaveMessage(""), 2200);
    } catch (error) {
      console.error("[Profile] note save failed", error);
      setNoteSaveMessage(error instanceof Error ? error.message : tr("Could not save note."));
    } finally {
      setIsSavingNote(false);
    }
  }

  async function onUpdatePassword() {
    setPasswordMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage(tr("Fill all password fields."));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage(tr("New password must be at least 8 characters."));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage(tr("New password and confirmation do not match."));
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updateCurrentPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(tr("Password updated."));
      window.setTimeout(() => setPasswordMessage(""), 2600);
    } catch (error) {
      console.error("[Profile] password update failed", error);
      setPasswordMessage(error instanceof Error ? error.message : tr("Could not update password."));
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  if (isLoading) {
    return (
      <div className="px-6 py-10 md:px-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
          {tr("loading profile...")}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-10 md:px-12">
      <header className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
            STUDIO · PROFILE
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">{tr("About you.")}</h1>
        </div>
        <HandwrittenNote>{tr("set the scene")}</HandwrittenNote>
      </header>

      <div className="mt-10 grid gap-6 md:grid-cols-12">
        <GlassCard className="self-start overflow-hidden p-0 md:col-span-4">
          <AvatarPreview photo={photo} note={note} status={status} statusLabel={statusLabel[status]} />
          <div className="relative p-5 pr-12">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {tr("Live preview")}
            </div>
            <div className="mt-1 font-display text-2xl">{displayName || profile?.email || "Blogger"}</div>
            <p className="mt-1 text-sm text-foreground/70">{tr("This is how others see you.")}</p>
            <div className="pointer-events-none absolute bottom-5 right-3 select-none font-display text-3xl leading-none tracking-tight text-foreground/[0.08] [writing-mode:vertical-rl] [text-orientation:mixed]">
              love potion.
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-6 md:col-span-8">
          <GlassCard tone="pink" className="p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
              {tr("Identity")}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label={tr("Display name")} value={displayName} onChange={setDisplayName} />
              <Field label={tr("SL avatar")} value={avatarName} onChange={setAvatarName} disabled />
              <Field label={tr("SL avatar UUID")} value={avatarUuid} onChange={setAvatarUuid} />
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                  Language
                </span>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as "en" | "es")}
                  className="mt-1 w-full rounded-full border border-foreground/20 bg-background/70 px-4 py-2 text-sm focus:border-[var(--brand-magenta)] focus:outline-none"
                >
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                </select>
              </label>
              <Field label={tr("Flickr")} value={flickr} onChange={setFlickr} />
              <Field label={tr("Instagram")} value={instagram} onChange={setInstagram} />
              <Field label={tr("Facebook")} value={facebook} onChange={setFacebook} />
              <Field label={tr("Blog URL")} value={blogUrl} onChange={setBlogUrl} />
            </div>
            <div className="mt-6 flex items-center gap-4">
              <img
                src={photo}
                alt="avatar"
                className="h-16 w-16 rounded-full object-cover ring-2 ring-[var(--brand-magenta)]/50"
              />
              <label className="cursor-pointer rounded-full border border-foreground/30 bg-background/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)]">
                {tr("Change photo")}
                <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              {saveMessage ? (
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    saveMessage === tr("Profile saved.")
                      ? "bg-green-100 text-green-700"
                      : "bg-rose-100 text-rose-700",
                  )}
                >
                  {saveMessage}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void onSaveProfile()}
                disabled={isSaving || !hasProfileChanges}
                className="rounded-full bg-[var(--brand-magenta)] px-5 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-white shadow-lg shadow-[var(--brand-magenta)]/15 hover:opacity-90 disabled:opacity-60"
              >
                {isSaving ? tr("Saving...") : tr("Save profile")}
              </button>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                {tr("Custom note")}
              </div>
              <span className="font-mono text-[10px] text-foreground/50">
                {note.length}/{STATUS_NOTE_MAX} · <span>{tr("max 2 lines")}</span>
              </span>
            </div>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={2}
              maxLength={STATUS_NOTE_MAX}
              className="mt-3 w-full resize-none rounded-2xl border border-foreground/20 bg-background/70 px-5 py-3 font-display text-xl leading-tight focus:border-[var(--brand-magenta)] focus:outline-none"
            />
            <select
              value={noteDuration}
              onChange={(event) => setNoteDuration(event.target.value as StatusNoteDuration)}
              className="mt-3 w-full rounded-full border border-foreground/20 bg-background/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/70 focus:border-[var(--brand-magenta)] focus:outline-none"
            >
              {getStatusNoteDurationOptions(uiLang).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="font-hand text-base text-[var(--brand-magenta)]">
                {tr("shown over your avatar, like instagram notes")}. {tr("choose a timer or leave it open-ended.")}
              </p>
              <div className="flex items-center gap-3">
                {noteSaveMessage ? (
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      noteSaveMessage === tr("Note saved.")
                        ? "bg-green-100 text-green-700"
                        : "bg-rose-100 text-rose-700",
                    )}
                  >
                    {noteSaveMessage}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void onSaveNote()}
                  disabled={isSavingNote}
                  className="rounded-full bg-[var(--brand-magenta)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-white shadow-lg shadow-[var(--brand-magenta)]/15 hover:opacity-90 disabled:opacity-60"
                >
                  {isSavingNote ? tr("Saving...") : tr("Save note")}
                </button>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {tr("Status")}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(["available", "vacation", "busy", "offline"] as Status[]).map((item) => {
                const active = status === item;
                return (
                  <button
                    key={item}
                    onClick={() => setStatus(item)}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition",
                      active
                        ? "border-[var(--brand-magenta)] bg-[var(--brand-magenta)]/10"
                        : "border-foreground/20 hover:border-foreground/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", STATUS_COLOR[item])} />
                      <span className="font-display text-lg">{statusLabel[item]}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {tr("Password")}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label={tr("Current")} type="password" value={currentPassword} onChange={setCurrentPassword} />
              <Field label={tr("New")} type="password" value={newPassword} onChange={setNewPassword} />
              <Field label={tr("Confirm new")} type="password" value={confirmPassword} onChange={setConfirmPassword} />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              {passwordMessage ? (
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    passwordMessage === tr("Password updated.")
                      ? "bg-green-100 text-green-700"
                      : "bg-rose-100 text-rose-700",
                  )}
                >
                  {passwordMessage}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void onUpdatePassword()}
                disabled={isUpdatingPassword}
                className="rounded-full bg-foreground px-6 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-wait disabled:opacity-60"
              >
                {isUpdatingPassword ? tr("Updating...") : tr("Update password")}
              </button>
            </div>
          </GlassCard>

        </div>
      </div>
    </div>
  );
}

function getSafeAvatarUrl(value?: string | null) {
  if (!value || value.startsWith("blob:")) return bloggerAvatar;
  return value;
}

function AvatarPreview({
  photo,
  note,
  status,
  statusLabel,
}: {
  photo: string;
  note: string;
  status: Status;
  statusLabel: string;
}) {
  const lines = note.split("\n").slice(0, 2);
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
      <img src={photo} alt="avatar" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/15 to-black/55" />
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 backdrop-blur-md">
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLOR[status])} />
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white">
          {statusLabel}
        </span>
      </div>
      {note && (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="text-center">
            {lines.map((line) => (
              <div
                key={line}
                className="font-display text-4xl uppercase leading-[0.95] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
        {label}
      </span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-full border border-foreground/20 bg-background/70 px-4 py-2 text-sm focus:border-[var(--brand-magenta)] focus:outline-none disabled:opacity-60"
      />
    </label>
  );
}

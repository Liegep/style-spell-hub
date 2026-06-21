import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

type Status = "available" | "vacation" | "busy" | "offline";

const STATUS_LABEL: Record<Status, string> = {
  available: "Active",
  vacation: "On vacation",
  busy: "Busy",
  offline: "Offline",
};

const STATUS_COLOR: Record<Status, string> = {
  available: "bg-[var(--brand-rose)]",
  vacation: "bg-[var(--brand-magenta)]",
  busy: "bg-foreground/60",
  offline: "bg-slate-400",
};

const NOTE_MAX = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [photo, setPhoto] = useState(bloggerAvatar);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarName, setAvatarName] = useState("");
  const [avatarUuid, setAvatarUuid] = useState("");
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [flickr, setFlickr] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [blogUrl, setBlogUrl] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("available");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const current = await getCurrentProfile();
        if (!mounted || !current) return;
        setProfile(current);
        setPhoto(getSafeAvatarUrl(current.avatar_url));
        setDisplayName(current.display_name || current.full_name || "");
        setAvatarName(current.sl_avatar_name || "");
        setAvatarUuid(current.sl_avatar_uuid || "");
        setLanguage(current.language_preference || "en");
        setFlickr(current.flickr_url || "");
        setInstagram(current.instagram_url || "");
        setFacebook(current.facebook_url || "");
        setBlogUrl(current.blog_url || "");
        setNote(current.status_message || "");
        setStatus((current.availability_status as Status) || "available");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhoto(URL.createObjectURL(file));
  };

  const onNoteChange = (value: string) => {
    const lines = value.split("\n").slice(0, 2);
    setNote(lines.join("\n").slice(0, NOTE_MAX));
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
      setSaveMessage("Profile saved.");
      window.setTimeout(() => setSaveMessage(""), 2600);
    } catch (error) {
      console.error("[Profile] save failed", error);
      setSaveMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onUpdatePassword() {
    setPasswordMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage("Fill all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("New password and confirmation do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updateCurrentPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
      window.setTimeout(() => setPasswordMessage(""), 2600);
    } catch (error) {
      console.error("[Profile] password update failed", error);
      setPasswordMessage(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  if (isLoading) {
    return (
      <div className="px-6 py-10 md:px-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
          loading profile...
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
          <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-7xl">About you.</h1>
        </div>
        <HandwrittenNote>set the scene</HandwrittenNote>
      </header>

      <div className="mt-10 grid gap-6 md:grid-cols-12">
        <GlassCard className="self-start overflow-hidden p-0 md:col-span-4">
          <AvatarPreview photo={photo} note={note} status={status} />
          <div className="relative p-5 pr-12">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              Live preview
            </div>
            <div className="mt-1 font-display text-2xl">{displayName || profile?.email || "Blogger"}</div>
            <p className="mt-1 text-sm text-foreground/70">This is how others see you.</p>
            <div className="pointer-events-none absolute bottom-5 right-3 select-none font-display text-3xl leading-none tracking-tight text-foreground/[0.08] [writing-mode:vertical-rl] [text-orientation:mixed]">
              love potion.
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-6 md:col-span-8">
          <GlassCard tone="pink" className="p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
              Identity
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Display name" value={displayName} onChange={setDisplayName} />
              <Field label="SL avatar" value={avatarName} onChange={setAvatarName} disabled />
              <Field label="SL avatar UUID" value={avatarUuid} onChange={setAvatarUuid} />
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
              <Field label="Flickr" value={flickr} onChange={setFlickr} />
              <Field label="Instagram" value={instagram} onChange={setInstagram} />
              <Field label="Facebook" value={facebook} onChange={setFacebook} />
              <Field label="Blog URL" value={blogUrl} onChange={setBlogUrl} />
            </div>
            <div className="mt-6 flex items-center gap-4">
              <img
                src={photo}
                alt="avatar"
                className="h-16 w-16 rounded-full object-cover ring-2 ring-[var(--brand-magenta)]/50"
              />
              <label className="cursor-pointer rounded-full border border-foreground/30 bg-background/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)]">
                Change photo
                <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
              </label>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                Custom note
              </div>
              <span className="font-mono text-[10px] text-foreground/50">
                {note.length}/{NOTE_MAX} · <span>max 2 lines</span>
              </span>
            </div>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={2}
              maxLength={NOTE_MAX}
              className="mt-3 w-full resize-none rounded-2xl border border-foreground/20 bg-background/70 px-5 py-3 font-display text-xl leading-tight focus:border-[var(--brand-magenta)] focus:outline-none"
            />
            <p className="mt-2 font-hand text-base text-[var(--brand-magenta)]">
              shown over your avatar, like instagram notes
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              Status
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
                      <span className="font-display text-lg">{STATUS_LABEL[item]}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              Password
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Current" type="password" value={currentPassword} onChange={setCurrentPassword} />
              <Field label="New" type="password" value={newPassword} onChange={setNewPassword} />
              <Field label="Confirm new" type="password" value={confirmPassword} onChange={setConfirmPassword} />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              {passwordMessage ? (
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    passwordMessage === "Password updated."
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
                {isUpdatingPassword ? "Updating..." : "Update password"}
              </button>
            </div>
          </GlassCard>

          <div className="flex items-center justify-end gap-3">
            {saveMessage ? (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  saveMessage === "Profile saved."
                    ? "bg-green-100 text-green-700"
                    : "bg-rose-100 text-rose-700",
                )}
              >
                {saveMessage}
              </span>
            ) : null}
            <button className="rounded-full border border-foreground/30 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] hover:bg-foreground/5">
              Discard
            </button>
            <button
              onClick={() => void onSaveProfile()}
              disabled={isSaving}
              className="rounded-full bg-[var(--brand-magenta)] px-6 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white hover:opacity-90 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save profile →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSafeAvatarUrl(value?: string | null) {
  if (!value || value.startsWith("blob:")) return bloggerAvatar;
  return value;
}

function AvatarPreview({ photo, note, status }: { photo: string; note: string; status: Status }) {
  const lines = note.split("\n").slice(0, 2);
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
      <img src={photo} alt="avatar" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/15 to-black/55" />
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 backdrop-blur-md">
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLOR[status])} />
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white">
          {STATUS_LABEL[status]}
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

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { cn } from "@/lib/utils";
import { getCurrentProfile } from "@/integrations/supabase/auth";
import {
  listBloggerApplications,
  reviewBloggerApplication,
  type ApplicationStatus,
} from "@/integrations/supabase/applications";
import { listApplicationFormFields } from "@/integrations/supabase/application-form";
import { getBloggerRejoinHistory, type BloggerRejoinHistory } from "@/integrations/supabase/blogger-rejoin";
import { createBloggerAccount } from "@/integrations/supabase/bloggers-admin";
import { notifySecondLifeQuietly, sendInternalMessage } from "@/integrations/supabase/messages";
import type { ApplicationFormField, BloggerApplication } from "@/integrations/supabase/database.types";

type LoginSummary = {
  displayName: string;
  loginName: string;
  email: string;
  usesInternalEmail: boolean;
  temporaryPassword: string;
  slAvatarUuid: string | null;
};

export function ApplicationsPanel() {
  const [applications, setApplications] = useState<BloggerApplication[]>([]);
  const [formFields, setFormFields] = useState<ApplicationFormField[]>([]);
  const [filter, setFilter] = useState<ApplicationStatus | "all">("pending");
  const [selected, setSelected] = useState<BloggerApplication | null>(null);
  const [comment, setComment] = useState("");
  const [onboardingUuid, setOnboardingUuid] = useState("");
  const [onboardingEmail, setOnboardingEmail] = useState("");
  const [onboardingPassword, setOnboardingPassword] = useState("");
  const [onboardingState, setOnboardingState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [onboardingMessage, setOnboardingMessage] = useState("");
  const [loginSummary, setLoginSummary] = useState<LoginSummary | null>(null);
  const [rejoinHistory, setRejoinHistory] = useState<BloggerRejoinHistory | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [state, setState] = useState<"idle" | "loading" | "reviewing" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadApplications() {
      setState("loading");
      setError("");
      try {
        const [rows, fields] = await Promise.all([
          listBloggerApplications(filter),
          listApplicationFormFields({ includeDisabled: true }),
        ]);
        if (!mounted) return;
        setApplications(rows);
        setFormFields(fields);
        setState("idle");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load applications.");
        setState("error");
      }
    }

    void loadApplications();
    return () => {
      mounted = false;
    };
  }, [filter]);

  function openApplication(application: BloggerApplication) {
    setSelected(application);
    setComment(application.review_comment ?? "");
    setOnboardingUuid(application.sl_avatar_uuid ?? "");
    setOnboardingEmail(getApplicantEmail(application, formFields));
    setOnboardingPassword("");
    setOnboardingState("idle");
    setOnboardingMessage("");
    setLoginSummary(null);
    setCopyState("idle");
    setRejoinHistory(null);
  }

  useEffect(() => {
    let mounted = true;
    const uuid = onboardingUuid.trim();

    async function loadRejoinHistory() {
      if (!uuid || !isUuid(uuid)) {
        setRejoinHistory(null);
        return;
      }

      const history = await getBloggerRejoinHistory(uuid);
      if (mounted) setRejoinHistory(history && history.totalSignals > 0 ? history : null);
    }

    void loadRejoinHistory();
    return () => {
      mounted = false;
    };
  }, [onboardingUuid]);

  async function handleReview(status: Exclude<ApplicationStatus, "pending">) {
    if (!selected) return;
    setState("reviewing");
    setError("");

    try {
      const profile = await getCurrentProfile();
      if (!profile?.id) throw new Error("Reviewer profile not found.");

      const reviewed = await reviewBloggerApplication({
        applicationId: selected.id,
        status,
        reviewComment: comment,
        reviewedBy: profile.id,
      });

      setApplications((current) =>
        filter === "all"
          ? current.map((item) => (item.id === reviewed.id ? reviewed : item))
          : current.filter((item) => item.id !== reviewed.id),
      );
      setSelected(reviewed);
      setState("idle");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review application.");
      setState("error");
    }
  }

  async function handleCreateBloggerFromApplication() {
    if (!selected) return;

    if (selected.status !== "approved") {
      setOnboardingState("error");
      setOnboardingMessage("Approve this application before creating the blogger account.");
      return;
    }

    if (!onboardingPassword.trim()) {
      setOnboardingState("error");
      setOnboardingMessage("Add a temporary password first.");
      return;
    }

    if (onboardingUuid.trim() && !isUuid(onboardingUuid.trim())) {
      setOnboardingState("error");
      setOnboardingMessage("SL UUID format looks invalid. Use full UUID (8-4-4-4-12).");
      return;
    }

    setOnboardingState("saving");
    setOnboardingMessage("");
    setLoginSummary(null);
    setCopyState("idle");

    try {
      const temporaryPassword = onboardingPassword;
      const displayName = getApplicantName(selected, formFields) || "Love Potion Blogger";
      const avatarName = selected.sl_avatar_name?.trim() || findAnswerByKeys(selected.answers, ["slAvatarName", "sl_avatar_name", "avatarName", "avatar_name"]) || displayName;
      const applicantEmail = onboardingEmail.trim().toLowerCase() || getApplicantEmail(selected, formFields);
      const usesInternalEmail = !applicantEmail;
      const loginEmail = applicantEmail || buildInternalBloggerEmail(selected, avatarName);
      const created = await createBloggerAccount({
        email: loginEmail,
        password: temporaryPassword,
        displayName,
        avatarName,
        avatarUuid: onboardingUuid.trim() || null,
        language: selected.language_preference,
        accountStatus: "active",
      });
      const loginName = created.profile.sl_avatar_name ?? avatarName;

      setLoginSummary({
        displayName: created.profile.display_name ?? displayName,
        loginName,
        email: created.profile.email,
        usesInternalEmail,
        temporaryPassword,
        slAvatarUuid: created.profile.sl_avatar_uuid,
      });

      let welcomeNoteCreated = false;
      let slWelcomeAttempted = false;

      try {
        const staffProfile = await getCurrentProfile();
        if (staffProfile?.id) {
          const welcomeBody = buildWelcomeMessage(selected.language_preference, loginName);
          await sendInternalMessage({
            senderId: staffProfile.id,
            scope: "personal",
            recipientId: created.userId,
            subject: selected.language_preference === "es" ? "Bienvenida a Love Potion" : "Welcome to Love Potion",
            body: welcomeBody,
          });
          welcomeNoteCreated = true;

          if (created.profile.sl_avatar_uuid) {
            slWelcomeAttempted = true;
            void notifySecondLifeQuietly(
              {
                recipientId: created.userId,
                type: "new_message",
                title: selected.language_preference === "es" ? "Love Potion HQ" : "Love Potion HQ",
                body:
                  selected.language_preference === "es"
                    ? "Tu cuenta blogger esta lista. Entra en Love Potion HQ para ver tu bienvenida."
                    : "Your blogger account is ready. Log in to Love Potion HQ to read your welcome note.",
              },
              "Blogger onboarding welcome",
            );
          }
        }
      } catch (welcomeError) {
        console.warn("[Applications] Blogger account created, but welcome notification failed.", welcomeError);
      }

      setOnboardingState("saved");
      setOnboardingMessage(
        welcomeNoteCreated
          ? slWelcomeAttempted
            ? "Blogger account created. Welcome note created, and the Second Life ping was attempted."
            : "Blogger account created. Welcome note created. Add an SL UUID if you want Second Life pings."
          : "Blogger account created. Welcome note could not be created, but the login summary is ready to copy.",
      );
      setOnboardingPassword("");
    } catch (createError) {
      setOnboardingState("error");
      setOnboardingMessage(createError instanceof Error ? createError.message : "Could not create blogger account.");
    }
  }

  async function copyLoginSummary() {
    if (!loginSummary) return;
    setCopyState("idle");
    try {
      await navigator.clipboard.writeText(buildLoginSummaryText(loginSummary));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              Application queue
            </div>
            <h3 className="mt-1 font-display text-3xl">Blogger hopefuls.</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["pending", "approved", "rejected", "all"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={cn(
                  "rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em]",
                  filter === status ? "bg-foreground text-background" : "bg-foreground/5 text-foreground/60",
                )}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[var(--brand-rose)] bg-white/70 px-5 py-4 text-sm text-[var(--brand-magenta)]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {state === "loading" ? (
            <div className="rounded-2xl border border-dashed border-foreground/20 p-10 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
              Loading applications...
            </div>
          ) : null}
          {state !== "loading" && applications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-foreground/20 p-10 text-center">
              <HandwrittenNote>No applications here.</HandwrittenNote>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
                Try another status filter.
              </div>
            </div>
          ) : null}
          {applications.map((application) => (
            <button
              key={application.id}
              type="button"
              onClick={() => openApplication(application)}
              className={cn(
                "rounded-2xl border p-5 text-left transition hover:border-[var(--brand-magenta)] hover:bg-white/60",
                selected?.id === application.id ? "border-[var(--brand-magenta)] bg-white/70" : "border-foreground/10",
              )}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                    {application.language_preference} · {formatDate(application.submitted_at)}
                  </div>
                  <h4 className="mt-1 font-display text-2xl">{formatApplicantName(application, formFields)}</h4>
                  <div className="mt-1 text-sm text-foreground/60">{application.sl_avatar_name || application.email}</div>
                </div>
                <span
                  className={cn(
                    "w-fit rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]",
                    application.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : application.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-[var(--brand-rose)]/40 text-[var(--brand-magenta)]",
                  )}
                >
                  {application.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard tone="pink" className="p-6">
        {selected ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              Review dossier
            </div>
            <h3 className="mt-2 font-display text-4xl leading-none">{formatApplicantName(selected, formFields)}</h3>
            <div className="mt-4 space-y-2 text-sm text-foreground/70">
              <ApplicationLine label="Email" value={getApplicantEmail(selected, formFields)} />
              <ApplicationLine label="Applicant name" value={getApplicantName(selected, formFields)} />
              <ApplicationLine label="SL avatar" value={selected.sl_avatar_name} />
              <ApplicationLine label="Flickr" value={selected.flickr_url} link />
              <ApplicationLine label="Instagram" value={selected.instagram_url} />
              <ApplicationLine label="Blog" value={selected.blog_url} link />
            </div>

            <ApplicationAnswerList answers={selected.answers} formFields={formFields} />

            <label className="mt-6 block">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                Internal review note
              </span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-foreground/20 bg-background/70 px-4 py-3 text-sm outline-none focus:border-[var(--brand-magenta)]"
                placeholder="Optional note about this application..."
              />
            </label>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={state === "reviewing"}
                onClick={() => void handleReview("approved")}
                className="rounded-full bg-green-600 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={state === "reviewing"}
                onClick={() => void handleReview("rejected")}
                className="rounded-full bg-[var(--brand-magenta)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-white disabled:opacity-50"
              >
                Reject
              </button>
            </div>
            {selected.status !== "pending" ? (
              <div className="mt-4 rounded-2xl bg-white/60 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/60">
                Reviewed as {selected.status}
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-white/70 bg-white/55 p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
                Approved onboarding
              </div>
              <p className="mt-2 text-sm text-foreground/65">
                After approval, create the real blogger login from this application.
              </p>
              <div className="mt-4 grid gap-3">
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                    Login email · optional
                  </span>
                  <input
                    type="email"
                    value={onboardingEmail}
                    onChange={(event) => setOnboardingEmail(event.target.value)}
                    className="mt-2 w-full rounded-full border border-foreground/15 bg-background/70 px-4 py-3 text-sm outline-none focus:border-[var(--brand-magenta)]"
                placeholder="blogger@email.com"
                  />
                  <p className="mt-2 text-xs text-foreground/55">
                    Optional. If empty, Love Potion creates a private technical email and she logs in with her avatar name.
                  </p>
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                    SL avatar UUID
                  </span>
                  <input
                    value={onboardingUuid}
                    onChange={(event) => setOnboardingUuid(event.target.value)}
                    className="mt-2 w-full rounded-full border border-foreground/15 bg-background/70 px-4 py-3 text-sm outline-none focus:border-[var(--brand-magenta)]"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                  {rejoinHistory ? (
                    <div className="mt-3 rounded-2xl border border-[var(--brand-magenta)]/30 bg-[var(--brand-pink)]/60 px-4 py-3 text-sm text-[var(--brand-magenta)]">
                      This UUID has left the blogger program {rejoinHistory.totalSignals} time{rejoinHistory.totalSignals === 1 ? "" : "s"} before. Review before creating a new account.
                    </div>
                  ) : null}
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                    Temporary password
                  </span>
                  <input
                    type="password"
                    minLength={6}
                    value={onboardingPassword}
                    onChange={(event) => setOnboardingPassword(event.target.value)}
                    className="mt-2 w-full rounded-full border border-foreground/15 bg-background/70 px-4 py-3 text-sm outline-none focus:border-[var(--brand-magenta)]"
                    placeholder="Give her a first password"
                  />
                </label>
              </div>
              {onboardingMessage ? (
                <div
                  className={cn(
                    "mt-4 rounded-2xl px-4 py-3 text-sm",
                    onboardingState === "saved"
                      ? "border border-green-300 bg-green-50 text-green-700"
                      : "border border-[var(--brand-rose)] bg-white/70 text-[var(--brand-magenta)]",
                  )}
                >
                  {onboardingMessage}
                </div>
              ) : null}
              {loginSummary ? (
                <div className="mt-4 rounded-2xl border border-[var(--brand-rose)] bg-background/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
                        Login note
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-foreground/75">
                        <div>
                          <span className="font-semibold text-foreground">Login:</span> {loginSummary.loginName}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">
                            {loginSummary.usesInternalEmail ? "Internal email:" : "Email:"}
                          </span>{" "}
                          {loginSummary.email}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">Temporary password:</span>{" "}
                          {loginSummary.temporaryPassword}
                        </div>
                        {loginSummary.slAvatarUuid ? (
                          <div className="break-all">
                            <span className="font-semibold text-foreground">SL UUID:</span> {loginSummary.slAvatarUuid}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyLoginSummary()}
                      className="rounded-full border border-[var(--brand-magenta)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--brand-magenta)] hover:bg-[var(--brand-magenta)] hover:text-white"
                    >
                      {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy"}
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                disabled={onboardingState === "saving" || selected.status !== "approved"}
                onClick={() => void handleCreateBloggerFromApplication()}
                className="mt-4 rounded-full bg-foreground px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {onboardingState === "saving" ? "Creating..." : "Create blogger login"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[360px] items-center justify-center text-center">
            <div>
              <HandwrittenNote>pick an application</HandwrittenNote>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
                The review will open here.
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function ApplicationLine({ label, value, link = false }: { label: string; value?: string | null; link?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">{label}</span>
      {link ? (
        <a className="ml-2 text-[var(--brand-magenta)] hover:underline" href={normalizeUrl(value)} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <span className="ml-2">{value}</span>
      )}
    </div>
  );
}

function ApplicationAnswerList({
  answers,
  formFields,
}: {
  answers: BloggerApplication["answers"];
  formFields: ApplicationFormField[];
}) {
  const entries = Object.entries(answers ?? {}).filter(([, value]) => formatAnswerValue(value));

  if (entries.length === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-background/60 p-4 text-sm text-foreground/55">
        No extra answers were sent with this application.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {entries.map(([key, value], index) => (
        <ApplicationAnswer key={key} label={formatAnswerLabel(key, formFields, index)} value={value} />
      ))}
    </div>
  );
}

function ApplicationAnswer({ label, value }: { label: string; value: unknown }) {
  const displayValue = formatAnswerValue(value);
  if (!displayValue) return null;
  return (
    <div className="rounded-2xl bg-background/60 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">{label}</div>
      <div className="mt-2 whitespace-pre-wrap text-sm text-foreground/75">{displayValue}</div>
    </div>
  );
}

function formatAnswerLabel(key: string, formFields: ApplicationFormField[], index = 0) {
  const labels: Record<string, string> = {
    languages: "Languages",
    hours: "Hours in-world",
    camera_style: "Camera & style",
    cameraStyle: "Camera & style",
    why_love_potion: "Why Love Potion?",
    whyLovePotion: "Why Love Potion?",
    displayName: "Display name",
    slAvatarName: "Second Life avatar name",
    email: "Email",
    flickrUrl: "Flickr",
    instagramUrl: "Instagram",
    blogUrl: "Blog",
  };

  const fieldLabel = formFields.find((field) => field.field_key === key)?.label?.trim();
  if (fieldLabel) return fieldLabel;

  if (/^custom[_-]?[a-z0-9]+$/i.test(key)) return `Answer ${index + 1}`;

  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAnswerValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

function normalizeUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatApplicantName(application: BloggerApplication, formFields: ApplicationFormField[]) {
  return (
    getApplicantName(application, formFields) ||
    application.sl_avatar_name?.trim() ||
    application.email.trim() ||
    "Untitled application"
  );
}

function getApplicantName(application: BloggerApplication, formFields: ApplicationFormField[]) {
  const directName = application.display_name?.trim();
  if (directName) return directName;

  const answerName = findAnswerByKeys(application.answers, [
    "name",
    "displayName",
    "display_name",
    "fullName",
    "full_name",
  ]);
  if (answerName) return answerName;

  const labeledField = formFields.find((field) => {
    const label = field.label.trim();
    return /name/i.test(label) || /nombre/i.test(label) || /display/i.test(label) || /full/i.test(label) || /applicant/i.test(label);
  });
  if (labeledField) {
    const answer = application.answers?.[labeledField.field_key];
    const normalized = formatAnswerValue(answer);
    if (normalized) return normalized;
  }

  const inferredName = inferApplicantNameFromAnswers(application.answers);
  if (inferredName) return inferredName;

  return application.sl_avatar_name?.trim() || application.email.trim() || "";
}

function getApplicantEmail(application: BloggerApplication, formFields: ApplicationFormField[]) {
  const directEmail = application.email?.trim();
  if (directEmail) return directEmail;

  const keyedEmail = findAnswerByKeys(application.answers, [
    "email",
    "emailAddress",
    "email_address",
    "mail",
  ]);
  if (isEmailLike(keyedEmail)) return keyedEmail;

  const labeledField = formFields.find((field) => {
    const label = field.label.trim();
    return /email/i.test(label) || /e-mail/i.test(label) || /correo/i.test(label);
  });
  if (labeledField) {
    const answer = formatAnswerValue(application.answers?.[labeledField.field_key]);
    if (isEmailLike(answer)) return answer;
  }

  const answerEmail = Object.values(application.answers ?? {})
    .map((value) => formatAnswerValue(value))
    .find(isEmailLike);

  return answerEmail ?? "";
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildInternalBloggerEmail(application: BloggerApplication, avatarName: string) {
  const readableSlug = slugifyForEmail(avatarName || getApplicantName(application, []) || "blogger");
  const stableId = application.id.replace(/[^a-z0-9]/gi, "").slice(0, 18).toLowerCase();
  return `${readableSlug || "blogger"}-${stableId}@accounts.lovepotion-sl.com`;
}

function slugifyForEmail(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 36);
}

function findAnswerByKeys(answers: BloggerApplication["answers"], keys: string[]) {
  for (const key of keys) {
    const value = formatAnswerValue(answers?.[key]);
    if (value) return value;
  }
  return "";
}

function inferApplicantNameFromAnswers(answers: BloggerApplication["answers"]) {
  const values = Object.values(answers ?? {})
    .map((value) => formatAnswerValue(value))
    .filter(Boolean);

  const likelyName = values.find((value) => {
    const normalized = value.trim();
    if (!normalized || normalized.length > 60) return false;
    if (/^https?:\/\//i.test(normalized) || normalized.includes("@")) return false;
    if (/^(yes|no|sim|não|nao|si)$/i.test(normalized)) return false;
    if (/[.!?]{1,}$/.test(normalized)) return false;
    return normalized.split(/\s+/).length >= 2;
  });

  return likelyName ?? "";
}

function buildWelcomeMessage(language: "en" | "es", loginName: string) {
  if (language === "es") {
    return [
      "Tu cuenta de blogger de Love Potion esta lista.",
      "",
      `Puedes entrar con tu nombre de avatar: ${loginName}`,
      "Desde tu atelier puedes reclamar productos, leer recomendaciones y enviar tus links de post.",
      "",
      "Bienvenida a la casa.",
    ].join("\n");
  }

  return [
    "Your Love Potion blogger account is ready.",
    "",
    `You can log in with your avatar name: ${loginName}`,
    "Inside your atelier you can claim products, read recommendations, and submit your post links.",
    "",
    "Welcome to the house.",
  ].join("\n");
}

function buildLoginSummaryText(summary: LoginSummary) {
  return [
    "Love Potion blogger login",
    "",
    `Name: ${summary.displayName}`,
    `Login: ${summary.loginName}`,
    summary.usesInternalEmail ? `Internal email: ${summary.email}` : `Email: ${summary.email}`,
    `Temporary password: ${summary.temporaryPassword}`,
    summary.slAvatarUuid ? `Second Life UUID: ${summary.slAvatarUuid}` : null,
    "",
    "Please log in and change your password from your profile.",
  ]
    .filter(Boolean)
    .join("\n");
}

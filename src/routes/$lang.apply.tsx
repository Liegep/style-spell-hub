import { Link, createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import aboutImg from "@/assets/about-editorial.jpg";
import { useT } from "@/i18n/dict";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { submitBloggerApplication } from "@/integrations/supabase/applications";
import { getBloggerAdmissionsSettings, listApplicationFormFields } from "@/integrations/supabase/application-form";
import type { ApplicationFormField } from "@/integrations/supabase/database.types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/$lang/apply")({
  component: ApplyPage,
});

function ApplyPage() {
  const { t, lang } = useT();
  const [fields, setFields] = useState<ApplicationFormField[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "idle" | "sending" | "sent" | "error">("loading");
  const [admissionsOpen, setAdmissionsOpen] = useState(true);
  const [error, setError] = useState("");
  const applicationsClosed = state !== "loading" && !admissionsOpen;

  useEffect(() => {
    let mounted = true;

    async function loadForm() {
      const [settings, rows] = await Promise.all([
        getBloggerAdmissionsSettings(),
        listApplicationFormFields(),
      ]);
      if (!mounted) return;
      setAdmissionsOpen(settings.open);
      setFields(rows);
      setForm(createEmptyForm(rows));
      setState("idle");
    }

    void loadForm();
    return () => {
      mounted = false;
    };
  }, []);

  const shortFields = useMemo(
    () => fields.filter((field) => field.field_key !== "slAvatarUuid" && !["long_text", "checkbox"].includes(field.field_type)),
    [fields],
  );
  const longFields = useMemo(
    () => fields.filter((field) => field.field_key !== "slAvatarUuid" && ["long_text", "checkbox"].includes(field.field_type)),
    [fields],
  );

  function updateField(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");

    try {
      const requiredMissing = fields.find((field) => field.required && !readFormValue(form, field.field_key));
      if (requiredMissing) {
        throw new Error(`Please fill: ${requiredMissing.label}.`);
      }
      const slAvatarUuid = readFormValue(form, "slAvatarUuid");
      if (slAvatarUuid && !UUID_RE.test(slAvatarUuid)) {
        throw new Error("SL avatar UUID format looks invalid. Use full UUID (8-4-4-4-12).");
      }

      await submitBloggerApplication({
        displayName: readFormValue(form, "displayName"),
        email: readFormValue(form, "email"),
        slAvatarName: readFormValue(form, "slAvatarName"),
        slAvatarUuid,
        languagePreference: lang,
        flickrUrl: readFormValue(form, "flickrUrl"),
        instagramUrl: readFormValue(form, "instagramUrl"),
        blogUrl: readFormValue(form, "blogUrl"),
        answers: buildApplicationAnswers(fields, form),
      });

      setState("sent");
      setForm(createEmptyForm(fields));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not send your application.");
      setState("error");
    }
  }

  return (
    <main className="px-6 pt-16 md:px-12">
      <div className="mx-auto max-w-[1200px]">
        {applicationsClosed ? (
          <>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              {t.apply.closedKicker}
            </div>
            <div className="mt-3 flex items-end justify-between gap-6">
              <h1 className="max-w-4xl font-display text-6xl leading-[0.9] md:text-[7rem]">
                {t.apply.closedTitle}
              </h1>
              <div className="hidden md:block">
                <HandwrittenNote withArrow>{t.apply.closedNote}</HandwrittenNote>
              </div>
            </div>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/80">
              {t.apply.closedBody}
            </p>
          </>
        ) : (
          <>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              {t.apply.kicker}
            </div>
            <div className="mt-3 flex items-end justify-between gap-6">
              <h1 className="font-display text-6xl leading-[0.9] md:text-[7rem]">
                {t.apply.title}
              </h1>
              <div className="hidden md:block">
                <HandwrittenNote withArrow>{t.apply.openNote}</HandwrittenNote>
              </div>
            </div>
            <p className="mt-6 max-w-xl text-lg text-foreground/80">{t.apply.intro}</p>
          </>
        )}

        {state === "loading" ? (
          <GlassCard tone="pink" className="mt-12 p-8 text-center md:p-12">
            <HandwrittenNote>{t.apply.loading}</HandwrittenNote>
          </GlassCard>
        ) : null}

        {applicationsClosed ? (
          <GlassCard tone="pink" className="mt-12 overflow-hidden p-0">
            <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="min-h-[420px] overflow-hidden">
                <img
                  src={aboutImg}
                  alt={t.apply.closedImageAlt}
                  className="h-full min-h-[420px] w-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-center p-8 md:p-14">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
                  {t.apply.closedCardKicker}
                </div>
                <h2 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] md:text-7xl">
                  {t.apply.closedCardTitle}
                </h2>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/70">
                  {t.apply.closedCardBody}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    to="/$lang/shop-info"
                    params={{ lang }}
                    className="rounded-full bg-foreground px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-background transition hover:bg-[var(--brand-magenta)]"
                  >
                    {t.apply.closedPrimary}
                  </Link>
                  <Link
                    to="/$lang/releases"
                    params={{ lang }}
                    className="rounded-full border border-foreground/25 bg-background/70 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] transition hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)]"
                  >
                    {t.apply.closedSecondary}
                  </Link>
                </div>
              </div>
            </div>
          </GlassCard>
        ) : null}

        {state !== "loading" && admissionsOpen ? (
        <GlassCard tone="pink" className="mt-12 p-8 md:p-12">
          <form onSubmit={onSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            {shortFields.map((field) => (
              <label key={field.field_key} className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <ApplicationFieldInput field={field} value={form[field.field_key] ?? ""} onChange={updateField} />
                {field.help_text ? <p className="mt-2 text-xs text-foreground/55">{field.help_text}</p> : null}
              </label>
            ))}
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                SL avatar UUID *
              </span>
              <input
                value={form.slAvatarUuid ?? ""}
                onChange={(event) => updateField("slAvatarUuid", event.target.value)}
                required
                className="mt-2 w-full rounded-full border border-foreground/30 bg-background/70 px-5 py-3 font-mono text-sm placeholder:text-foreground/40 focus:border-[var(--brand-magenta)] focus:outline-none"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="mt-2 text-xs text-foreground/55">
                This helps Love Potion identify previous applications and account history.
              </p>
            </label>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {longFields.map((field) => (
              <label key={field.field_key} className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <ApplicationFieldInput field={field} value={form[field.field_key] ?? ""} onChange={updateField} />
                {field.help_text ? <p className="mt-2 text-xs text-foreground/55">{field.help_text}</p> : null}
              </label>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60">
              {t.apply.note}
            </p>
            <button
              disabled={state === "sending"}
              className="rounded-full bg-foreground px-8 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-background hover:bg-[var(--brand-magenta)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "sending" ? "Sending..." : `${t.apply.submit} →`}
            </button>
          </div>
          {state === "sent" ? (
            <div className="mt-6 rounded-2xl border border-green-300 bg-green-50 px-5 py-4 text-sm text-green-700">
              Application sent. Love Potion HQ will review it soon.
            </div>
          ) : null}
          {state === "error" ? (
            <div className="mt-6 rounded-2xl border border-[var(--brand-rose)] bg-white/70 px-5 py-4 text-sm text-[var(--brand-magenta)]">
              {error}
            </div>
          ) : null}
          </form>
        </GlassCard>
        ) : null}
      </div>
    </main>
  );
}

function ApplicationFieldInput({
  field,
  value,
  onChange,
}: {
  field: ApplicationFormField;
  value: string;
  onChange: (fieldKey: string, value: string) => void;
}) {
  const commonClass =
    "mt-2 w-full border border-foreground/30 bg-background/70 px-5 py-3 font-mono text-sm placeholder:text-foreground/40 focus:border-[var(--brand-magenta)] focus:outline-none";

  if (field.field_type === "long_text") {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(field.field_key, event.target.value)}
        required={field.required}
        rows={4}
        className={`${commonClass} rounded-2xl`}
        placeholder={field.placeholder ?? ""}
      />
    );
  }

  if (field.field_type === "select") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(field.field_key, event.target.value)}
        required={field.required}
        className={`${commonClass} rounded-full`}
      >
        <option value="">Choose...</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.field_type === "checkbox") {
    return (
      <span className="mt-3 inline-flex items-center gap-3 rounded-full border border-foreground/20 bg-background/70 px-5 py-3">
        <input
          type="checkbox"
          checked={value === "yes"}
          onChange={(event) => onChange(field.field_key, event.target.checked ? "yes" : "")}
          required={field.required}
          className="h-4 w-4 accent-[var(--brand-magenta)]"
        />
        <span className="text-sm text-foreground/70">{field.placeholder || "Yes"}</span>
      </span>
    );
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(field.field_key, event.target.value)}
      required={field.required}
      type={field.field_type === "email" ? "email" : field.field_type === "url" ? "url" : field.field_type === "date" ? "date" : "text"}
      className={`${commonClass} rounded-full`}
      placeholder={field.placeholder ?? ""}
    />
  );
}

function createEmptyForm(fields: ApplicationFormField[]) {
  return fields.reduce<Record<string, string>>((next, field) => {
    next[field.field_key] = "";
    return next;
  }, { slAvatarUuid: "" });
}

function readFormValue(form: Record<string, string>, fieldKey: string) {
  return (form[fieldKey] ?? "").trim();
}

function buildApplicationAnswers(fields: ApplicationFormField[], form: Record<string, string>) {
  const coreKeys = new Set(["displayName", "slAvatarName", "slAvatarUuid", "email", "flickrUrl", "instagramUrl", "blogUrl"]);
  return fields.reduce<Record<string, string>>((answers, field) => {
    if (!coreKeys.has(field.field_key)) {
      answers[field.field_key] = readFormValue(form, field.field_key);
    }
    return answers;
  }, {});
}

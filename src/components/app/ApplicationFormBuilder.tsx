import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { cn } from "@/lib/utils";
import {
  DEFAULT_APPLICATION_FORM_FIELDS,
  getBloggerAdmissionsSettings,
  listApplicationFormFields,
  publishApplicationFormFields,
  updateBloggerAdmissionsSettings,
} from "@/integrations/supabase/application-form";
import type { ApplicationFieldType, ApplicationFormField } from "@/integrations/supabase/database.types";
import { translateAppPhrase } from "@/i18n/app-text";
import { useLang } from "@/i18n/dict";

const FIELD_TYPES: Array<{ value: ApplicationFieldType; label: string }> = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
];

export function ApplicationFormBuilder() {
  const language = useLang();
  const tr = (value: string) => translateAppPhrase(value, language);
  const [fields, setFields] = useState<ApplicationFormField[]>(DEFAULT_APPLICATION_FORM_FIELDS);
  const [selectedKey, setSelectedKey] = useState(DEFAULT_APPLICATION_FORM_FIELDS[0]?.field_key ?? "");
  const [scrollToKey, setScrollToKey] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [admissionsOpen, setAdmissionsOpen] = useState(true);
  const [admissionsState, setAdmissionsState] = useState<"idle" | "saving" | "error">("idle");
  const [admissionsMessage, setAdmissionsMessage] = useState("");
  const [message, setMessage] = useState("");
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let mounted = true;

    async function loadFields() {
      setState("loading");
      setMessage("");
      const [settings, rows] = await Promise.all([
        getBloggerAdmissionsSettings(),
        listApplicationFormFields({ includeDisabled: true }),
      ]);
      if (!mounted) return;
      setAdmissionsOpen(settings.open);
      setFields(rows);
      setSelectedKey(rows[0]?.field_key ?? "");
      setState("idle");
    }

    void loadFields();
    return () => {
      mounted = false;
    };
  }, []);

  const selected = useMemo(
    () => fields.find((field) => field.field_key === selectedKey) ?? fields[0],
    [fields, selectedKey],
  );

  const publishedCount = fields.filter((field) => field.enabled).length;

  useEffect(() => {
    if (!scrollToKey) return;

    const frame = window.requestAnimationFrame(() => {
      fieldRefs.current[scrollToKey]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setScrollToKey("");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [fields, scrollToKey]);

  function updateField(fieldKey: string, patch: Partial<ApplicationFormField>) {
    setFields((current) =>
      current.map((field) => {
        if (field.field_key !== fieldKey) return field;
        return {
          ...field,
          ...patch,
        };
      }),
    );
    setState("idle");
  }

  function addField(type: ApplicationFieldType = "short_text") {
    const fieldKey = `custom_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const nextField: ApplicationFormField = {
      id: fieldKey,
      field_key: fieldKey,
      label: "New question",
      field_type: type,
      placeholder: "",
      help_text: "",
      options: type === "select" ? ["Option 1", "Option 2"] : [],
      required: false,
      enabled: true,
      sort_order: fields.length + 1,
      created_at: "",
      updated_at: "",
    };

    setFields((current) => [...current, nextField]);
    setSelectedKey(fieldKey);
    setScrollToKey(fieldKey);
    setState("idle");
  }

  function moveField(fieldKey: string, direction: -1 | 1) {
    setFields((current) => {
      const index = current.findIndex((field) => field.field_key === fieldKey);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      const [field] = next.splice(index, 1);
      next.splice(targetIndex, 0, field);
      return next.map((item, itemIndex) => ({ ...item, sort_order: itemIndex + 1 }));
    });
    setState("idle");
  }

  function removeField(fieldKey: string) {
    setFields((current) => current.filter((field) => field.field_key !== fieldKey));
    setSelectedKey((current) => {
      if (current !== fieldKey) return current;
      return fields.find((field) => field.field_key !== fieldKey)?.field_key ?? "";
    });
    setState("idle");
  }

  async function publish() {
    setState("saving");
    setMessage("");

    try {
      await publishApplicationFormFields(fields);
      setState("saved");
      setMessage(tr("Application form published. The public apply page will use these questions."));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : tr("Could not publish the form."));
    }
  }

  async function clearAndPublish() {
    setState("saving");
    setMessage("");

    try {
      await publishApplicationFormFields([]);
      setFields([]);
      setSelectedKey("");
      setState("saved");
      setMessage(tr("Application form cleared. The public apply page has no custom questions."));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : tr("Could not publish the form."));
    }
  }

  async function toggleAdmissions(nextOpen = !admissionsOpen) {
    const previousOpen = admissionsOpen;
    setAdmissionsOpen(nextOpen);
    setAdmissionsState("saving");
    setAdmissionsMessage("");
    setMessage("");

    try {
      const settings = await updateBloggerAdmissionsSettings({ open: nextOpen });
      setAdmissionsOpen(settings.open);
      setAdmissionsState("idle");
      setState("saved");
      setAdmissionsMessage(settings.open ? tr("Blogger applications are open.") : tr("Blogger applications are paused."));
    } catch (error) {
      setAdmissionsOpen(previousOpen);
      setAdmissionsState("error");
      setState("error");
      setAdmissionsMessage(error instanceof Error ? error.message : tr("Could not update blogger admissions."));
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-start gap-2">
        <div className="glass-pink inline-flex max-w-full flex-wrap items-center gap-3 rounded-full px-3 py-2 shadow-sm">
          <div>
            <div className="font-mono text-[7px] uppercase tracking-[0.24em] text-[var(--brand-magenta)]">
              {tr("Blogger admissions")}
            </div>
            <div className="mt-0.5 whitespace-nowrap font-display text-lg leading-none md:text-xl">
              {tr(admissionsOpen ? "Applications are open." : "Applications are paused.")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void toggleAdmissions()}
            disabled={admissionsState === "saving"}
            aria-pressed={admissionsOpen}
            className={cn(
              "inline-flex w-fit min-w-[148px] shrink-0 items-center justify-center gap-3 rounded-full border px-4 py-2 font-mono text-[7px] uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-50",
              admissionsOpen
                ? "border-[var(--brand-magenta)] bg-[var(--brand-magenta)] text-white"
                : "border-foreground/15 bg-white/70 text-foreground/65 hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)]",
            )}
          >
            <span
              className={cn(
                "inline-flex h-7 min-w-11 shrink-0 items-center justify-center rounded-full bg-white px-3 text-[var(--brand-magenta)] transition",
                !admissionsOpen && "bg-foreground text-background",
              )}
            >
              {admissionsOpen ? "ON" : "OFF"}
            </span>
            <span>
              {admissionsState === "saving" ? tr("Saving...") : tr(admissionsOpen ? "Close admissions" : "Open admissions")}
            </span>
          </button>
        </div>
        {admissionsMessage ? (
          <div
            className={cn(
              "rounded-full border bg-white/70 px-3 py-2 text-xs",
              admissionsState === "error"
                ? "border-[var(--brand-rose)] text-[var(--brand-magenta)]"
                : "border-green-300 text-green-700",
            )}
          >
            {admissionsMessage}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <GlassCard tone="pink" className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              Form builder
            </div>
            <h3 className="mt-2 font-display text-3xl leading-none">Question stack.</h3>
          </div>
          <span className="inline-flex min-w-[88px] items-center justify-center whitespace-nowrap rounded-full bg-white/70 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/55">
            {publishedCount} live
          </span>
        </div>

        <div className="mt-6 grid gap-2">
          {FIELD_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => addField(type.value)}
              className="flex items-center justify-between rounded-full border border-white/70 bg-white/50 px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/70 transition hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)]"
            >
              {type.label}
              <Plus className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-white/70 bg-white/50 p-4">
          <HandwrittenNote>publish the spell</HandwrittenNote>
          <p className="mt-3 text-sm text-foreground/60">
            Published questions appear on the public application page. You can remove every question and publish a clean, empty form.
          </p>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={state === "saving"}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-background transition hover:bg-[var(--brand-magenta)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {state === "saving" ? "Publishing..." : "Publish form"}
          </button>
          <button
            type="button"
            onClick={() => void clearAndPublish()}
            disabled={state === "saving" || fields.length === 0}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--brand-magenta)] bg-white/60 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--brand-magenta)] transition hover:bg-[var(--brand-magenta)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 className="h-4 w-4" />
            {state === "saving" ? "Clearing..." : "Clear and publish empty form"}
          </button>
          {message ? (
            <div
              className={cn(
                "mt-4 rounded-2xl border px-4 py-3 text-sm",
                state === "saved"
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-[var(--brand-rose)] bg-white/75 text-[var(--brand-magenta)]",
              )}
            >
              {message}
            </div>
          ) : null}
        </div>
      </GlassCard>

      <GlassCard className="p-6 md:p-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/55">
              Live application form
            </div>
            <h3 className="mt-2 font-display text-4xl leading-none">Build the gate.</h3>
          </div>
          {state === "loading" ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/45">Loading...</span>
          ) : null}
        </div>

        <div className="mt-8 grid gap-4">
          {fields.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-foreground/15 bg-background/40 p-8 text-center">
              <HandwrittenNote>clean slate</HandwrittenNote>
              <p className="mt-3 text-sm text-foreground/55">No questions are in this form. Add one on the left when you are ready.</p>
            </div>
          ) : null}
          {fields.map((field, index) => {
            const active = selected?.field_key === field.field_key;
            return (
              <div
                key={field.field_key}
                ref={(element) => {
                  fieldRefs.current[field.field_key] = element;
                }}
                className={cn(
                  "rounded-2xl border bg-background/50 p-5 transition",
                  active ? "border-[var(--brand-magenta)] shadow-[0_18px_45px_rgba(219,24,97,0.12)]" : "border-foreground/10",
                  !field.enabled && "opacity-45",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <button type="button" onClick={() => setSelectedKey(field.field_key)} className="text-left">
                    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/45">
                      {String(index + 1).padStart(2, "0")} · {field.field_type.replace("_", " ")}
                    </div>
                    <h4 className="mt-1 font-display text-2xl">{field.label || "Untitled question"}</h4>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <IconButton label="Move up" onClick={() => moveField(field.field_key, -1)} disabled={index === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Move down" onClick={() => moveField(field.field_key, 1)} disabled={index === fields.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={field.enabled ? "Hide" : "Show"}
                      onClick={() => updateField(field.field_key, { enabled: !field.enabled })}
                    >
                      {field.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </IconButton>
                    <IconButton label="Remove" onClick={() => removeField(field.field_key)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                {active ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <BuilderInput
                      label="Question label"
                      value={field.label}
                      onChange={(value) => updateField(field.field_key, { label: value })}
                    />
                    <label>
                      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/55">Field type</span>
                      <select
                        value={field.field_type}
                        onChange={(event) => updateField(field.field_key, { field_type: event.target.value as ApplicationFieldType })}
                        className="mt-2 w-full rounded-full border border-foreground/15 bg-white/70 px-4 py-3 text-sm outline-none focus:border-[var(--brand-magenta)] disabled:opacity-50"
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <BuilderInput
                      label="Placeholder"
                      value={field.placeholder ?? ""}
                      onChange={(value) => updateField(field.field_key, { placeholder: value })}
                    />
                    <BuilderInput
                      label="Help text"
                      value={field.help_text ?? ""}
                      onChange={(value) => updateField(field.field_key, { help_text: value })}
                    />
                    {field.field_type === "select" || field.field_type === "checkbox" ? (
                      <label className="md:col-span-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/55">
                          Options, one per line
                        </span>
                        <textarea
                          value={field.options.join("\n")}
                          onChange={(event) => updateField(field.field_key, { options: event.target.value.split("\n") })}
                          rows={4}
                          className="mt-2 w-full rounded-2xl border border-foreground/15 bg-white/70 px-4 py-3 text-sm outline-none focus:border-[var(--brand-magenta)]"
                        />
                      </label>
                    ) : null}
                    <label className="inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/65">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => updateField(field.field_key, { required: event.target.checked })}
                        className="h-4 w-4 accent-[var(--brand-magenta)]"
                      />
                      Required
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </GlassCard>
      </div>
    </div>
  );
}

function BuilderInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/55">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-full border border-foreground/15 bg-white/70 px-4 py-3 text-sm outline-none focus:border-[var(--brand-magenta)]"
      />
    </label>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 bg-white/70 text-foreground/60 transition hover:border-[var(--brand-magenta)] hover:text-[var(--brand-magenta)] disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

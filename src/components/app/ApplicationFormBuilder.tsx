import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/brand/GlassCard";
import { HandwrittenNote } from "@/components/brand/HandwrittenNote";
import { cn } from "@/lib/utils";
import {
  DEFAULT_APPLICATION_FORM_FIELDS,
  isCoreApplicationField,
  listApplicationFormFields,
  publishApplicationFormFields,
} from "@/integrations/supabase/application-form";
import type { ApplicationFieldType, ApplicationFormField } from "@/integrations/supabase/database.types";

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
  const [fields, setFields] = useState<ApplicationFormField[]>(DEFAULT_APPLICATION_FORM_FIELDS);
  const [selectedKey, setSelectedKey] = useState(DEFAULT_APPLICATION_FORM_FIELDS[0]?.field_key ?? "");
  const [scrollToKey, setScrollToKey] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let mounted = true;

    async function loadFields() {
      setState("loading");
      setMessage("");
      const rows = await listApplicationFormFields({ includeDisabled: true });
      if (!mounted) return;
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
        const locked = isCoreApplicationField(field.field_key);
        return {
          ...field,
          ...patch,
          enabled: locked ? true : patch.enabled ?? field.enabled,
          required: locked ? true : patch.required ?? field.required,
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
    if (isCoreApplicationField(fieldKey)) return;
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
      setMessage("Application form published. The public apply page will use these questions.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not publish the form.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <GlassCard tone="pink" className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--brand-magenta)]">
              Form builder
            </div>
            <h3 className="mt-2 font-display text-3xl leading-none">Question stack.</h3>
          </div>
          <span className="rounded-full bg-white/70 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-foreground/55">
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
            Published questions appear on the public application page. Core identity fields stay locked so account creation keeps working.
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
          {fields.map((field, index) => {
            const locked = isCoreApplicationField(field.field_key);
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
                      {locked ? " · core" : ""}
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
                      disabled={locked}
                    >
                      {field.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </IconButton>
                    <IconButton label="Remove" onClick={() => removeField(field.field_key)} disabled={locked}>
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
                        disabled={locked}
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
                        disabled={locked}
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

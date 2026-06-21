import { supabase } from "@/integrations/supabase/client";
import type { ApplicationFormField } from "@/integrations/supabase/database.types";

export type ApplicationFieldType = ApplicationFormField["field_type"];

const CORE_FIELD_KEYS = ["displayName", "slAvatarName", "email"] as const;

export const DEFAULT_APPLICATION_FORM_FIELDS: ApplicationFormField[] = [
  {
    id: "displayName",
    field_key: "displayName",
    label: "Display name",
    field_type: "short_text",
    placeholder: "Aria Solstice",
    help_text: null,
    options: [],
    required: true,
    enabled: true,
    sort_order: 10,
    created_at: "",
    updated_at: "",
  },
  {
    id: "slAvatarName",
    field_key: "slAvatarName",
    label: "Second Life avatar name",
    field_type: "short_text",
    placeholder: "Resident.Lastname",
    help_text: null,
    options: [],
    required: true,
    enabled: true,
    sort_order: 20,
    created_at: "",
    updated_at: "",
  },
  {
    id: "email",
    field_key: "email",
    label: "Email",
    field_type: "email",
    placeholder: "you@email.com",
    help_text: null,
    options: [],
    required: true,
    enabled: true,
    sort_order: 30,
    created_at: "",
    updated_at: "",
  },
  {
    id: "flickrUrl",
    field_key: "flickrUrl",
    label: "Flickr URL",
    field_type: "url",
    placeholder: "https://flickr.com/you",
    help_text: null,
    options: [],
    required: false,
    enabled: true,
    sort_order: 40,
    created_at: "",
    updated_at: "",
  },
  {
    id: "instagramUrl",
    field_key: "instagramUrl",
    label: "Instagram / social handle",
    field_type: "short_text",
    placeholder: "@yourhandle",
    help_text: null,
    options: [],
    required: false,
    enabled: true,
    sort_order: 50,
    created_at: "",
    updated_at: "",
  },
  {
    id: "blogUrl",
    field_key: "blogUrl",
    label: "Blog / Primfeed",
    field_type: "url",
    placeholder: "https://primfeed.com/you",
    help_text: null,
    options: [],
    required: false,
    enabled: true,
    sort_order: 60,
    created_at: "",
    updated_at: "",
  },
  {
    id: "languages",
    field_key: "languages",
    label: "Languages",
    field_type: "short_text",
    placeholder: "EN, ES, FR...",
    help_text: null,
    options: [],
    required: false,
    enabled: true,
    sort_order: 70,
    created_at: "",
    updated_at: "",
  },
  {
    id: "hours",
    field_key: "hours",
    label: "Hours per week",
    field_type: "select",
    placeholder: null,
    help_text: null,
    options: ["1-5 / week", "5-10 / week", "10-20 / week", "20+ / week"],
    required: false,
    enabled: true,
    sort_order: 80,
    created_at: "",
    updated_at: "",
  },
  {
    id: "cameraStyle",
    field_key: "cameraStyle",
    label: "Camera & style",
    field_type: "long_text",
    placeholder: "Firestorm, Black Dragon, no edit, heavy edit...",
    help_text: null,
    options: [],
    required: false,
    enabled: true,
    sort_order: 90,
    created_at: "",
    updated_at: "",
  },
  {
    id: "whyLovePotion",
    field_key: "whyLovePotion",
    label: "Why Love Potion?",
    field_type: "long_text",
    placeholder: "Tell us in your own voice.",
    help_text: null,
    options: [],
    required: false,
    enabled: true,
    sort_order: 100,
    created_at: "",
    updated_at: "",
  },
];

export function isCoreApplicationField(fieldKey: string) {
  return (CORE_FIELD_KEYS as readonly string[]).includes(fieldKey);
}

export async function listApplicationFormFields(options: { includeDisabled?: boolean } = {}) {
  const { data, error } = await supabase
    .from("application_form_fields")
    .select("id,field_key,label,field_type,placeholder,help_text,options,required,enabled,sort_order,created_at,updated_at")
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[Application Form] using fallback fields", error);
    return options.includeDisabled ? DEFAULT_APPLICATION_FORM_FIELDS : DEFAULT_APPLICATION_FORM_FIELDS.filter((field) => field.enabled);
  }

  const fields = normalizeFields(data ?? []);
  const safeFields = ensureCoreFields(fields);
  return options.includeDisabled ? safeFields : safeFields.filter((field) => field.enabled);
}

export async function publishApplicationFormFields(fields: ApplicationFormField[]) {
  const normalized = ensureCoreFields(fields).map((field, index) => ({
    field_key: field.field_key,
    label: field.label.trim() || "Untitled question",
    field_type: field.field_type,
    placeholder: field.placeholder?.trim() || null,
    help_text: field.help_text?.trim() || null,
    options: field.options.filter(Boolean),
    required: isCoreApplicationField(field.field_key) ? true : field.required,
    enabled: isCoreApplicationField(field.field_key) ? true : field.enabled,
    sort_order: index + 1,
  }));

  const { error } = await supabase
    .from("application_form_fields")
    .upsert(normalized, { onConflict: "field_key" });

  if (error) throw error;
}

function normalizeFields(rows: Array<Record<string, unknown>>): ApplicationFormField[] {
  return rows
    .map((row) => {
      const options = Array.isArray(row.options)
        ? row.options
        : typeof row.options === "string"
          ? parseOptions(row.options)
          : [];

      return {
        id: String(row.id ?? row.field_key ?? crypto.randomUUID()),
        field_key: String(row.field_key ?? ""),
        label: String(row.label ?? "Untitled question"),
        field_type: normalizeType(row.field_type),
        placeholder: typeof row.placeholder === "string" ? row.placeholder : null,
        help_text: typeof row.help_text === "string" ? row.help_text : null,
        options: options.map(String),
        required: Boolean(row.required),
        enabled: row.enabled !== false,
        sort_order: Number(row.sort_order ?? 0),
        created_at: String(row.created_at ?? ""),
        updated_at: String(row.updated_at ?? ""),
      };
    })
    .filter((field) => field.field_key);
}

function ensureCoreFields(fields: ApplicationFormField[]) {
  const byKey = new Map(fields.map((field) => [field.field_key, field]));
  const merged = [...fields];

  for (const coreField of DEFAULT_APPLICATION_FORM_FIELDS.filter((field) => isCoreApplicationField(field.field_key))) {
    const existing = byKey.get(coreField.field_key);
    if (existing) {
      existing.required = true;
      existing.enabled = true;
    } else {
      merged.unshift(coreField);
    }
  }

  return merged.sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeType(value: unknown): ApplicationFieldType {
  const accepted: ApplicationFieldType[] = ["short_text", "long_text", "email", "url", "select", "checkbox", "date"];
  return accepted.includes(value as ApplicationFieldType) ? (value as ApplicationFieldType) : "short_text";
}

function parseOptions(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

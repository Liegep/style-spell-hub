import { supabase } from "@/integrations/supabase/client";
import type { ApplicationFormField } from "@/integrations/supabase/database.types";

export type ApplicationFieldType = ApplicationFormField["field_type"];
export type BloggerAdmissionsSettings = {
  open: boolean;
  rulesText: string;
};

const BLOGGER_ADMISSIONS_SETTINGS_FIELD_KEY = "__blogger_admissions_settings";
const DEFAULT_BLOGGER_ADMISSIONS: BloggerAdmissionsSettings = { open: true, rulesText: "" };

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
  return options.includeDisabled ? fields : fields.filter((field) => field.enabled);
}

export async function publishApplicationFormFields(fields: ApplicationFormField[]) {
  const normalized = fields.map((field, index) => ({
    field_key: field.field_key,
    label: field.label.trim() || "Untitled question",
    field_type: field.field_type,
    placeholder: field.placeholder?.trim() || null,
    help_text: field.help_text?.trim() || null,
    options: field.options.filter(Boolean),
    required: field.required,
    enabled: field.enabled,
    sort_order: index + 1,
  }));

  const { data: existingRows, error: listError } = await supabase
    .from("application_form_fields")
    .select("field_key");

  if (listError) throw listError;

  const publishedKeys = new Set(normalized.map((field) => field.field_key));
  const staleKeys = (existingRows ?? [])
    .map((row) => String(row.field_key ?? ""))
    .filter((fieldKey) => fieldKey && fieldKey !== BLOGGER_ADMISSIONS_SETTINGS_FIELD_KEY && !publishedKeys.has(fieldKey));

  if (staleKeys.length > 0) {
    const { error: deleteError } = await supabase
      .from("application_form_fields")
      .delete()
      .in("field_key", staleKeys);

    if (deleteError) throw deleteError;
  }

  if (normalized.length === 0) return;

  const { error } = await supabase
    .from("application_form_fields")
    .upsert(normalized, { onConflict: "field_key" });

  if (error) throw error;
}

export async function getBloggerAdmissionsSettings(): Promise<BloggerAdmissionsSettings> {
  const { data, error } = await supabase
    .from("application_form_fields")
    .select("help_text,options")
    .eq("field_key", BLOGGER_ADMISSIONS_SETTINGS_FIELD_KEY)
    .maybeSingle();

  if (error) {
    console.warn("[Application Form] using default admissions settings", error);
    return DEFAULT_BLOGGER_ADMISSIONS;
  }

  return normalizeAdmissionsSettings(readAdmissionsSettingsRow(data));
}

export async function updateBloggerAdmissionsSettings(settings: BloggerAdmissionsSettings) {
  const normalized = normalizeAdmissionsSettings(settings);
  const { error } = await supabase
    .from("application_form_fields")
    .upsert(
      {
        field_key: BLOGGER_ADMISSIONS_SETTINGS_FIELD_KEY,
        label: "Blogger admissions settings",
        field_type: "checkbox",
        placeholder: null,
        help_text: JSON.stringify(normalized),
        options: [normalized.open ? "open" : "closed"],
        required: false,
        enabled: true,
        sort_order: -1000,
      },
      { onConflict: "field_key" },
    );

  if (error) throw error;

  return normalized;
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
    .filter((field) => field.field_key && field.field_key !== BLOGGER_ADMISSIONS_SETTINGS_FIELD_KEY);
}

function normalizeAdmissionsSettings(value: unknown): BloggerAdmissionsSettings {
  if (!value || typeof value !== "object") return DEFAULT_BLOGGER_ADMISSIONS;
  const record = value as Record<string, unknown>;
  return {
    open: record.open !== false,
    rulesText: typeof record.rulesText === "string" ? record.rulesText : "",
  };
}

function readAdmissionsSettingsRow(row: unknown) {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record.help_text === "string" && record.help_text.trim()) {
    try {
      return JSON.parse(record.help_text);
    } catch {
      return null;
    }
  }

  const options = Array.isArray(record.options) ? record.options.map(String) : [];
  if (options.includes("closed")) return { open: false };
  if (options.includes("open")) return { open: true };
  return null;
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

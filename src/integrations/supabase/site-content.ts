import { supabase } from "@/integrations/supabase/client";
import type { Lang } from "@/i18n/dict";

export type SiteContentRow = {
  key: string;
  language: Lang;
  label: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
};

export type SiteContentInput = {
  key: string;
  language: Lang;
  label: string;
  value: string;
};

export async function listSiteContent(language: Lang) {
  const { data, error } = await supabase
    .from("site_content")
    .select("*")
    .eq("language", language)
    .order("key", { ascending: true })
    .returns<SiteContentRow[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getSiteContentValues(language: Lang) {
  const rows = await listSiteContent(language);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function upsertSiteContent(rows: SiteContentInput[]) {
  const { data, error } = await supabase
    .from("site_content")
    .upsert(rows, { onConflict: "key,language" })
    .select("*")
    .returns<SiteContentRow[]>();

  if (error) throw error;
  return data ?? [];
}

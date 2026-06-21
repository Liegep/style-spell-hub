import { supabase } from "@/integrations/supabase/client";
import type { SharedResource } from "@/integrations/supabase/database.types";

export async function listSharedResources() {
  const { data, error } = await supabase
    .from("shared_resources")
    .select("id,kind,title,url,description,sort_order,created_by,created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SharedResource[];
}

export async function createSharedLink(input: {
  title: string;
  url: string;
  description?: string | null;
  sortOrder?: number;
}) {
  const { data, error } = await supabase
    .from("shared_resources")
    .insert({
      kind: "link",
      title: input.title.trim(),
      url: input.url.trim(),
      description: input.description?.trim() || null,
      sort_order: input.sortOrder ?? 0,
    })
    .select("id,kind,title,url,description,sort_order,created_by,created_at")
    .single<SharedResource>();

  if (error) throw error;
  return data;
}

export async function createSharedImage(input: {
  title: string;
  file: File;
  description?: string | null;
  sortOrder?: number;
}) {
  const ext = input.file.name.split(".").pop()?.toLowerCase() || "png";
  const safeTitle = input.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const filePath = `${Date.now()}-${safeTitle || "asset"}.${ext}`;

  const upload = await supabase.storage.from("goodies").upload(filePath, input.file, {
    upsert: true,
    contentType: input.file.type,
  });
  if (upload.error) throw upload.error;

  const { data: publicData } = supabase.storage.from("goodies").getPublicUrl(filePath);
  const url = publicData.publicUrl;

  const { data, error } = await supabase
    .from("shared_resources")
    .insert({
      kind: "image",
      title: input.title.trim(),
      url,
      description: input.description?.trim() || null,
      sort_order: input.sortOrder ?? 0,
    })
    .select("id,kind,title,url,description,sort_order,created_by,created_at")
    .single<SharedResource>();

  if (error) throw error;
  return data;
}

export async function updateSharedResource(
  id: string,
  patch: Pick<SharedResource, "title" | "url" | "description" | "sort_order">,
) {
  const { data, error } = await supabase
    .from("shared_resources")
    .update({
      title: patch.title.trim(),
      url: patch.url.trim(),
      description: patch.description?.trim() || null,
      sort_order: patch.sort_order,
    })
    .eq("id", id)
    .select("id,kind,title,url,description,sort_order,created_by,created_at")
    .single<SharedResource>();

  if (error) throw error;
  return data;
}

export async function deleteSharedResource(id: string) {
  const { error } = await supabase.from("shared_resources").delete().eq("id", id);
  if (error) throw error;
}

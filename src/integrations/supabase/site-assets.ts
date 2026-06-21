import { supabase } from "@/integrations/supabase/client";

export type SiteAssetKey =
  | "landing_hero"
  | "login_editorial"
  | "about_editorial"
  | "newsletter_preview"
  | "logo_icon";

export type SiteAsset = {
  key: SiteAssetKey;
  label: string;
  description: string | null;
  image_url: string;
  updated_at: string;
  updated_by: string | null;
};

export type SiteAssetInput = {
  key: SiteAssetKey;
  label: string;
  description?: string | null;
  imageUrl: string;
};

export async function listSiteAssets() {
  const { data, error } = await supabase
    .from("site_assets")
    .select("*")
    .order("label", { ascending: true })
    .returns<SiteAsset[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getSiteAssetMap() {
  const rows = await listSiteAssets();
  return new Map(rows.map((asset) => [asset.key, asset]));
}

export async function getSiteAssetUrl(key: SiteAssetKey) {
  const { data, error } = await supabase
    .from("site_assets")
    .select("image_url")
    .eq("key", key)
    .maybeSingle<{ image_url: string }>();

  if (error) throw error;
  return data?.image_url ?? null;
}

export async function uploadSiteAssetImage(key: SiteAssetKey, file: File) {
  const webp = await fileToWebp(file);
  const path = `site/${key}-${Date.now()}.webp`;

  const { error } = await supabase.storage.from("content-assets").upload(path, webp, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("content-assets").getPublicUrl(path);
  return data.publicUrl;
}

export async function upsertSiteAsset(input: SiteAssetInput) {
  const { data, error } = await supabase
    .from("site_assets")
    .upsert(
      {
        key: input.key,
        label: input.label,
        description: input.description ?? null,
        image_url: input.imageUrl,
      },
      { onConflict: "key" },
    )
    .select("*")
    .single<SiteAsset>();

  if (error) throw error;
  return data;
}

async function fileToWebp(file: File) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Could not prepare image conversion.");

  const maxWidth = 2200;
  const maxHeight = 2200;
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);

  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not convert image to WebP."));
      },
      "image/webp",
      0.9,
    );
  });
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

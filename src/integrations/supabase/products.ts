import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/integrations/supabase/audit-log";
import type { ProductRelease, ProductReleaseImage, ProductStatus } from "@/integrations/supabase/database.types";
import type { ProductSummary } from "@/integrations/supabase/dashboard";

export type ProductReleaseInput = {
  id?: string;
  name: string;
  category: string | null;
  short_description: string | null;
  long_description: string | null;
  handwritten_note: string | null;
  blogging_recommendations: string | null;
  editorial_image_url: string | null;
  image_url: string | null;
  vendor_poster_url: string | null;
  second_life_link: string | null;
  marketplace_link: string | null;
  release_date: string | null;
  deadline_at: string | null;
  blogging_deadline_days: number | null;
  status: ProductStatus;
  featured_on_landing: boolean;
  display_order: number;
  delivery_item_key: string | null;
  auto_archive_at: string | null;
};

export type ProductEditorSeed = ProductSummary &
  Partial<
    Pick<
      ProductRelease,
      | "long_description"
      | "blogging_recommendations"
      | "second_life_link"
      | "marketplace_link"
      | "deadline_at"
      | "blogging_deadline_days"
      | "delivery_item_key"
    >
  >;

export function makeProductId() {
  return crypto.randomUUID();
}

export function makeSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function getProductRelease(id: string) {
  const { data, error } = await supabase
    .from("product_releases")
    .select("*")
    .eq("id", id)
    .single<ProductRelease>();

  if (error) throw error;
  return data;
}

export async function listProductReleaseImages(productId: string) {
  const { data, error } = await supabase
    .from("product_release_images")
    .select("id,product_id,image_url,alt_text,is_cover,sort_order,created_at")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (/product_release_images|schema cache|relation/i.test(error.message ?? "")) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as ProductReleaseImage[];
}

export async function replaceProductReleaseImages(
  productId: string,
  images: Array<{
    image_url: string;
    alt_text?: string | null;
    is_cover?: boolean;
    sort_order: number;
  }>,
) {
  const { error: deleteError } = await supabase
    .from("product_release_images")
    .delete()
    .eq("product_id", productId);

  if (deleteError) {
    if (/product_release_images|schema cache|relation/i.test(deleteError.message ?? "")) {
      return [];
    }
    throw deleteError;
  }

  if (images.length === 0) return [];

  const { data, error } = await supabase
    .from("product_release_images")
    .insert(
      images.map((image, index) => ({
        product_id: productId,
        image_url: image.image_url,
        alt_text: image.alt_text ?? null,
        is_cover: image.is_cover ?? index === 0,
        sort_order: image.sort_order,
      })),
    )
    .select("id,product_id,image_url,alt_text,is_cover,sort_order,created_at");

  if (error) {
    if (/product_release_images|schema cache|relation/i.test(error.message ?? "")) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as ProductReleaseImage[];
}

export async function upsertProductRelease(input: ProductReleaseInput) {
  const isUpdate = Boolean(input.id);
  const id = input.id ?? makeProductId();
  const payload = {
    ...input,
    id,
    slug: makeSlug(input.name) || id,
  };

  let { data, error } = await supabase
    .from("product_releases")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single<ProductRelease>();

  if (error && /blogging_deadline_days|schema cache|column/i.test(error.message ?? "")) {
    const { blogging_deadline_days: _bloggingDeadlineDays, ...fallbackPayload } = payload;
    const fallback = await supabase
      .from("product_releases")
      .upsert(fallbackPayload, { onConflict: "id" })
      .select("*")
      .single<Omit<ProductRelease, "blogging_deadline_days">>();

    data = fallback.data ? { ...fallback.data, blogging_deadline_days: null } : null;
    error = fallback.error;
  }

  if (error) throw error;
  if (!data) throw new Error("Could not save product release.");

  void logAuditEvent({
    action: isUpdate ? "Updated product release" : "Created product release",
    targetType: "product",
    targetId: data.id,
    targetName: data.name,
    metadata: {
      status: data.status,
      featured_on_landing: data.featured_on_landing,
      delivery_item_key: Boolean(data.delivery_item_key),
    },
  });

  return data;
}

export async function archiveProductRelease(id: string) {
  const { error } = await supabase
    .from("product_releases")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) throw error;

  void logAuditEvent({
    action: "Archived product release",
    targetType: "product",
    targetId: id,
  });
}

export async function deleteProductRelease(id: string) {
  const rpcResult = await supabase.rpc("delete_product_release_cascade", {
    target_product_id: id,
  });

  if (!rpcResult.error) {
    void logAuditEvent({
      action: "Deleted product release",
      targetType: "product",
      targetId: id,
    });
    return;
  }

  if (!/delete_product_release_cascade|schema cache|function/i.test(rpcResult.error.message ?? "")) {
    throw rpcResult.error;
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("blog_submissions")
    .select("id")
    .eq("product_id", id);

  if (submissionsError) throw submissionsError;

  const submissionIds = (submissions ?? []).map((submission) => submission.id);

  if (submissionIds.length > 0) {
    const { error: linksError } = await supabase
      .from("blog_submission_links")
      .delete()
      .in("submission_id", submissionIds);
    if (linksError) throw linksError;

    const { error: deleteSubmissionsError } = await supabase
      .from("blog_submissions")
      .delete()
      .eq("product_id", id);
    if (deleteSubmissionsError) throw deleteSubmissionsError;
  }

  const { error: claimsError } = await supabase
    .from("product_claims")
    .delete()
    .eq("product_id", id);

  if (claimsError) throw claimsError;

  const { error: productError } = await supabase.from("product_releases").delete().eq("id", id);
  if (productError) throw productError;

  void logAuditEvent({
    action: "Deleted product release",
    targetType: "product",
    targetId: id,
  });
}

export async function uploadProductImage(
  productId: string,
  kind: "editorial" | "vendor" | "gallery",
  file: File,
) {
  const webp = await fileToWebp(
    file,
    kind === "editorial" || kind === "gallery" ? { width: 1200, height: 1600 } : undefined,
  );
  const path = `${productId}/${kind}-${Date.now()}.webp`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, webp, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

async function fileToWebp(file: File, fixedSize?: { width: number; height: number }) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Could not prepare image conversion.");

  if (fixedSize) {
    canvas.width = fixedSize.width;
    canvas.height = fixedSize.height;

    const sourceRatio = image.width / image.height;
    const targetRatio = fixedSize.width / fixedSize.height;
    const sourceWidth = sourceRatio > targetRatio ? image.height * targetRatio : image.width;
    const sourceHeight = sourceRatio > targetRatio ? image.height : image.width / targetRatio;
    const sourceX = (image.width - sourceWidth) / 2;
    const sourceY = (image.height - sourceHeight) / 2;

    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, fixedSize.width, fixedSize.height);
  } else {
    const maxWidth = 2048;
    const scale = Math.min(1, maxWidth / image.width);
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

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

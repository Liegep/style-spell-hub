import { supabase } from "@/integrations/supabase/client";
import type {
  BlogSubmission,
  BlogSubmissionLink,
  ProductClaim,
  ProductRelease,
  Profile,
  SubmissionStatus,
} from "@/integrations/supabase/database.types";

export type BloggerProduct = Pick<
  ProductRelease,
  | "id"
  | "name"
  | "category"
  | "short_description"
  | "blogging_recommendations"
  | "editorial_image_url"
  | "image_url"
  | "vendor_poster_url"
  | "release_date"
  | "deadline_at"
  | "second_life_link"
  | "status"
>;

export type BloggerSubmissionSummary = Pick<
  BlogSubmission,
  "id" | "product_id" | "status" | "submitted_at" | "review_comment"
> & {
  links_count: number;
};

export type SubmissionLinkInput = Pick<BlogSubmissionLink, "platform" | "url" | "note" | "sort_order">;
export type SubmissionLinkRow = Pick<BlogSubmissionLink, "id" | "platform" | "url" | "note" | "sort_order">;
export type SubmissionCommentProfile = Pick<
  Profile,
  "id" | "display_name" | "full_name" | "email" | "avatar_url" | "status_message" | "availability_status"
>;
export type BloggerProductClaimSummary = Pick<
  ProductClaim,
  "id" | "product_id" | "status" | "claimed_at" | "delivered_at"
>;
export type ClaimProductResult = Pick<
  ProductClaim,
  "id" | "product_id" | "status" | "delivery_response" | "claimed_at" | "delivered_at"
> & {
  deliveryNotice?: string;
};

export async function listAvailableProductsForBlogger() {
  const { data, error } = await supabase
    .from("product_releases")
    .select(
      "id,name,category,short_description,blogging_recommendations,editorial_image_url,image_url,vendor_poster_url,release_date,deadline_at,second_life_link,status",
    )
    .eq("status", "available")
    .order("display_order", { ascending: true })
    .order("release_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BloggerProduct[];
}

export async function listSubmissionSummariesForBlogger(bloggerId: string) {
  const { data, error } = await supabase
    .from("blog_submissions")
    .select("id,product_id,status,submitted_at,review_comment,blog_submission_links(id)")
    .eq("blogger_id", bloggerId)
    .order("submitted_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<
    Pick<BlogSubmission, "id" | "product_id" | "status" | "submitted_at" | "review_comment"> & {
      blog_submission_links?: Array<{ id: string }>;
    }
  >;

  return rows.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    status: row.status,
    submitted_at: row.submitted_at,
    review_comment: row.review_comment,
    links_count: row.blog_submission_links?.length ?? 0,
  })) satisfies BloggerSubmissionSummary[];
}

export async function listProductClaimsForBlogger(bloggerId: string) {
  const { data, error } = await supabase
    .from("product_claims")
    .select("id,product_id,status,claimed_at,delivered_at")
    .eq("blogger_id", bloggerId)
    .order("claimed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BloggerProductClaimSummary[];
}

export async function getLatestSubmissionForProduct(bloggerId: string, productId: string) {
  const { data, error } = await supabase
    .from("blog_submissions")
    .select("id,product_id,status,submitted_at,review_comment,blogger_note,reviewed_by")
    .eq("blogger_id", bloggerId)
    .eq("product_id", productId)
    .order("submitted_at", { ascending: false });

  if (error) throw error;

  const rows =
    (data ?? []) as Array<
      Pick<BlogSubmission, "id" | "product_id" | "status" | "submitted_at" | "review_comment" | "blogger_note" | "reviewed_by">
    >;

  if (rows.length === 0) return null;

  const latest = rows[0];
  const latestReviewRow = rows.find((row) => Boolean(row.review_comment?.trim())) ?? null;
  const latestReviewNote = latestReviewRow?.review_comment ?? null;
  let latestReviewer: SubmissionCommentProfile | null = null;

  if (latestReviewRow?.reviewed_by) {
    latestReviewer = await getCommentProfileById(latestReviewRow.reviewed_by);
  }

  if (latestReviewNote && !latestReviewer) {
    latestReviewer = await getPrimaryStaffCommentProfile();
  }

  const { data: linksData, error: linksError } = await supabase
    .from("blog_submission_links")
    .select("id,platform,url,note,sort_order")
    .eq("submission_id", latest.id)
    .order("sort_order", { ascending: true });

  if (linksError) throw linksError;

  return {
    latest,
    latestReviewNote,
    latestReviewer,
    links: ((linksData ?? []) as SubmissionLinkRow[]).map((link) => ({
      id: link.id,
      platform: link.platform,
      url: link.url,
      note: link.note,
      sort_order: link.sort_order,
    })),
  };
}

async function getCommentProfileById(profileId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id,display_name,full_name,email,avatar_url,status_message,availability_status")
    .eq("id", profileId)
    .maybeSingle<SubmissionCommentProfile>();

  return data ?? null;
}

async function getPrimaryStaffCommentProfile() {
  const { data } = await supabase
    .from("profiles")
    .select("id,display_name,full_name,email,avatar_url,status_message,availability_status,role,account_status")
    .in("role", ["admin", "super_admin"])
    .neq("account_status", "left")
    .limit(10);

  const staff = (data ?? []) as Array<
    SubmissionCommentProfile & { role?: string; account_status?: string }
  >;

  return (
    staff.find((profile) =>
      [profile.display_name, profile.full_name, profile.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes("marie")),
    ) ??
    staff.find((profile) => profile.role === "super_admin") ??
    staff[0] ??
    null
  );
}

async function requestSecondLifeDelivery(productId: string, claimId: string) {
  try {
    const { data, error } = await supabase.functions.invoke("deliver-product", {
      body: { productId, claimId },
    });

    if (error) {
      const details = await getFunctionErrorMessage(error);
      return {
        delivered: false,
        notice: `Claim saved, but Second Life delivery failed. ${details}`,
      };
    }

    const payload = (data ?? {}) as { delivered?: boolean; message?: string };
    return {
      delivered: payload.delivered === true,
      notice: payload.message ?? (payload.delivered ? "Second Life delivery requested." : "Claim saved."),
    };
  } catch (error) {
    return {
      delivered: false,
      notice: `Claim saved, but Second Life delivery could not be reached. ${
        error instanceof Error ? error.message : "Try again after the delivery bridge is configured."
      }`,
    };
  }
}

async function getFunctionErrorMessage(error: unknown) {
  const response = (error as { context?: unknown }).context;

  if (response instanceof Response) {
    try {
      const payload = (await response.clone().json()) as { message?: string };
      if (payload.message) return payload.message;
    } catch {
      try {
        const text = await response.clone().text();
        if (text) return text;
      } catch {
        // Fall through to the generic message below.
      }
    }
  }

  return error instanceof Error ? error.message : "Try again after the delivery bridge is configured.";
}

async function getProductClaimById(claimId: string) {
  const { data, error } = await supabase
    .from("product_claims")
    .select("id,product_id,status,delivery_response,claimed_at,delivered_at")
    .eq("id", claimId)
    .maybeSingle<
      Pick<ProductClaim, "id" | "product_id" | "status" | "delivery_response" | "claimed_at" | "delivered_at">
    >();

  if (error) throw error;
  return data;
}

export async function claimProductForBlogger(productId: string, bloggerId: string): Promise<ClaimProductResult> {
  const { data: existingClaim, error: findError } = await supabase
    .from("product_claims")
    .select("id,product_id,status,delivery_response,claimed_at,delivered_at")
    .eq("product_id", productId)
    .eq("blogger_id", bloggerId)
    .maybeSingle<
      Pick<ProductClaim, "id" | "product_id" | "status" | "delivery_response" | "claimed_at" | "delivered_at">
    >();

  if (findError) throw findError;
  if (existingClaim) {
    if (existingClaim.status === "delivered") return existingClaim;

    const delivery = await requestSecondLifeDelivery(productId, existingClaim.id);
    const refreshedClaim = await getProductClaimById(existingClaim.id).catch(() => null);

    return {
      ...(refreshedClaim ?? existingClaim),
      status: refreshedClaim?.status ?? (delivery.delivered ? "delivered" : existingClaim.status),
      delivered_at: refreshedClaim?.delivered_at ?? (delivery.delivered ? new Date().toISOString() : existingClaim.delivered_at),
      deliveryNotice: delivery.notice,
    };
  }

  const { data, error } = await supabase
    .from("product_claims")
    .insert({
      product_id: productId,
      blogger_id: bloggerId,
      status: "claimed",
    })
    .select("id,product_id,status,delivery_response,claimed_at,delivered_at")
    .single<
      Pick<ProductClaim, "id" | "product_id" | "status" | "delivery_response" | "claimed_at" | "delivered_at">
    >();

  if (error) throw error;

  const delivery = await requestSecondLifeDelivery(productId, data.id);
  const refreshedClaim = await getProductClaimById(data.id).catch(() => null);

  return {
    ...(refreshedClaim ?? data),
    status: refreshedClaim?.status ?? (delivery.delivered ? "delivered" : data.status),
    delivered_at: refreshedClaim?.delivered_at ?? (delivery.delivered ? new Date().toISOString() : data.delivered_at),
    deliveryNotice: delivery.notice,
  };
}

export async function submitLinksForProduct(input: {
  productId: string;
  bloggerId: string;
  bloggerNote: string | null;
  links: SubmissionLinkInput[];
}) {
  const claim = await claimProductForBlogger(input.productId, input.bloggerId);

  const { data: existingSubmissions, error: existingError } = await supabase
    .from("blog_submissions")
    .select("id,product_id,status,submitted_at,review_comment")
    .eq("product_id", input.productId)
    .eq("blogger_id", input.bloggerId)
    .in("status", ["pending", "needs_revision"])
    .order("submitted_at", { ascending: false })
    .limit(1);

  if (existingError) throw existingError;
  const existingSubmission = existingSubmissions?.[0] as
    | Pick<BlogSubmission, "id" | "product_id" | "status" | "submitted_at" | "review_comment">
    | undefined;

  const submissionRequest = existingSubmission
    ? supabase
        .from("blog_submissions")
        .update({
          status: "pending",
          blogger_note: input.bloggerNote,
          review_comment: null,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", existingSubmission.id)
        .select("id,product_id,status,submitted_at,review_comment")
        .single<Pick<BlogSubmission, "id" | "product_id" | "status" | "submitted_at" | "review_comment">>()
    : supabase
        .from("blog_submissions")
        .insert({
          product_id: input.productId,
          blogger_id: input.bloggerId,
          claim_id: claim.id,
          status: "pending",
          blogger_note: input.bloggerNote,
        })
        .select("id,product_id,status,submitted_at,review_comment")
        .single<Pick<BlogSubmission, "id" | "product_id" | "status" | "submitted_at" | "review_comment">>();

  const { data: submission, error: submissionError } = await submissionRequest;
  if (submissionError) throw submissionError;

  if (existingSubmission) {
    const { error: deleteLinksError } = await supabase
      .from("blog_submission_links")
      .delete()
      .eq("submission_id", submission.id);
    if (deleteLinksError) throw deleteLinksError;
  }

  const linksPayload = input.links.map((link, index) => ({
    submission_id: submission.id,
    platform: link.platform,
    url: link.url,
    note: link.note,
    sort_order: link.sort_order ?? index,
  }));

  if (linksPayload.length > 0) {
    const { error: linksError } = await supabase.from("blog_submission_links").insert(linksPayload);
    if (linksError) throw linksError;
  }

  return submission;
}

export function statusLabel(status: SubmissionStatus) {
  if (status === "needs_revision") return "Needs revision";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending review";
}

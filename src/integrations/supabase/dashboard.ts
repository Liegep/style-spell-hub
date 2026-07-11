import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/integrations/supabase/audit-log";
import type {
  AvailabilityStatus,
  BlogSubmission,
  ClaimStatus,
  ProductClaim,
  ProductRelease,
  Profile,
  SubmissionStatus,
} from "@/integrations/supabase/database.types";

export type AtelierStats = {
  activeBloggers: number;
  inactiveBloggers: number;
  postsThisMonth: number;
  productsLive: number;
  archiveSoon: number;
  subscribers: number;
  statsErrors?: AtelierStatsError[];
};

export type AtelierStatsError = {
  label: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type BloggerPulse = Pick<
  Profile,
  "id" | "display_name" | "full_name" | "email" | "account_status" | "availability_status" | "status_message"
> & {
  posts_this_month?: number;
};

export type ProductSummary = Pick<
  ProductRelease,
  | "id"
  | "name"
  | "category"
  | "short_description"
  | "handwritten_note"
  | "editorial_image_url"
  | "image_url"
  | "vendor_poster_url"
  | "release_date"
  | "blogging_deadline_days"
  | "status"
  | "featured_on_landing"
  | "display_order"
  | "auto_archive_at"
> & {
  claims_count?: number;
  submissions_count?: number;
};

export type ReviewQueueItem = Pick<
  BlogSubmission,
  "id" | "status" | "submitted_at" | "review_comment" | "blogger_note"
> & {
  product_id: string;
  product_name: string;
  product_image: string | null;
  blogger_id: string;
  blogger_name: string;
  blogger_avatar_url: string | null;
  blogger_status_message: string | null;
  blogger_availability_status: AvailabilityStatus | null;
  links_count: number;
  links: Array<{
    id: string;
    platform: string;
    url: string;
    note: string | null;
    sort_order: number;
  }>;
};

export type DeliveryDeskItem = Pick<
  ProductClaim,
  "id" | "product_id" | "blogger_id" | "status" | "delivery_response" | "claimed_at" | "delivered_at"
> & {
  product_name: string;
  product_image: string | null;
  delivery_item_key: string | null;
  blogger_name: string;
  blogger_avatar_uuid: string | null;
  blogger_avatar_name: string | null;
};

function startOfCurrentMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function inThirtyDaysIso() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

type CountResult = {
  count: number;
  error?: AtelierStatsError;
};

function normalizeStatsError(label: string, error: unknown): AtelierStatsError {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      label,
      message: typeof record.message === "string" ? record.message : "Unknown Supabase error.",
      code: typeof record.code === "string" ? record.code : undefined,
      details: typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
    };
  }

  return {
    label,
    message: error instanceof Error ? error.message : String(error || "Unknown Supabase error."),
  };
}

async function safeCount(label: string, query: PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<CountResult> {
  const { data, error } = await query;
  if (error) {
    console.error(`[Atelier stats] Could not count ${label}`, error);
    return { count: 0, error: normalizeStatsError(label, error) };
  }
  return { count: data?.length ?? 0 };
}

async function countAtelierStatsDirectly(): Promise<AtelierStats> {
  const [activeBloggers, inactiveBloggers, postsThisMonth, productsLive, archiveSoon, subscribers] = await Promise.all([
    safeCount(
      "active bloggers",
      supabase
        .from("profiles")
        .select("id")
        .eq("role", "blogger")
        .eq("account_status", "active")
        .range(0, 999),
    ),
    safeCount(
      "inactive bloggers",
      supabase
        .from("profiles")
        .select("id")
        .eq("role", "blogger")
        .neq("account_status", "active")
        .range(0, 999),
    ),
    safeCount(
      "posts this month",
      supabase
        .from("blog_submissions")
        .select("id")
        .gte("submitted_at", startOfCurrentMonthIso())
        .range(0, 999),
    ),
    safeCount(
      "live products",
      supabase
        .from("product_releases")
        .select("id")
        .eq("status", "available")
        .range(0, 999),
    ),
    safeCount(
      "archive soon products",
      supabase
        .from("product_releases")
        .select("id")
        .eq("status", "available")
        .not("auto_archive_at", "is", null)
        .lte("auto_archive_at", inThirtyDaysIso())
        .range(0, 999),
    ),
    safeCount(
      "active subscribers",
      supabase
        .from("newsletter_subscribers")
        .select("id")
        .eq("is_active", true)
        .is("unsubscribed_at", null)
        .range(0, 999),
    ),
  ]);
  const statsErrors = [activeBloggers, inactiveBloggers, postsThisMonth, productsLive, archiveSoon, subscribers]
    .map((result) => result.error)
    .filter((error): error is AtelierStatsError => Boolean(error));

  return {
    activeBloggers: activeBloggers.count,
    inactiveBloggers: inactiveBloggers.count,
    postsThisMonth: postsThisMonth.count,
    productsLive: productsLive.count,
    archiveSoon: archiveSoon.count,
    subscribers: subscribers.count,
    statsErrors,
  };
}

export async function getAtelierStats(): Promise<AtelierStats> {
  return countAtelierStatsDirectly();
}

export async function getUpcomingArchives() {
  const { data, error } = await supabase
    .from("product_releases")
    .select("id,name,auto_archive_at")
    .eq("status", "available")
    .not("auto_archive_at", "is", null)
    .order("auto_archive_at", { ascending: true })
    .limit(5);

  if (error) throw error;
  return data ?? [];
}

export async function getBloggerPulse() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,full_name,email,account_status,availability_status,status_message")
    .eq("role", "blogger")
    .order("updated_at", { ascending: false })
    .limit(4);

  if (error) throw error;
  return (data ?? []) as BloggerPulse[];
}

export async function getProductSummaries() {
  const withProductActivity = async (products: ProductSummary[]) => {
    const productIds = products.map((product) => product.id);
    if (productIds.length === 0) return products;

    const [claimsResult, submissionsResult] = await Promise.all([
      supabase.from("product_claims").select("product_id").in("product_id", productIds),
      supabase.from("blog_submissions").select("product_id").in("product_id", productIds),
    ]);

    if (claimsResult.error) console.warn("[Product summaries] Could not load claim counts", claimsResult.error);
    if (submissionsResult.error) console.warn("[Product summaries] Could not load submission counts", submissionsResult.error);

    const claimCounts = new Map<string, number>();
    const submissionCounts = new Map<string, number>();

    (claimsResult.data ?? []).forEach((claim) => {
      claimCounts.set(claim.product_id, (claimCounts.get(claim.product_id) ?? 0) + 1);
    });
    (submissionsResult.data ?? []).forEach((submission) => {
      submissionCounts.set(submission.product_id, (submissionCounts.get(submission.product_id) ?? 0) + 1);
    });

    return products.map((product) => ({
      ...product,
      claims_count: claimCounts.get(product.id) ?? 0,
      submissions_count: submissionCounts.get(product.id) ?? 0,
    }));
  };

  const { data, error } = await supabase
    .from("product_releases")
    .select(
      "id,name,category,short_description,handwritten_note,editorial_image_url,image_url,vendor_poster_url,release_date,blogging_deadline_days,status,featured_on_landing,display_order,auto_archive_at",
    )
    .order("display_order", { ascending: true })
    .order("release_date", { ascending: false })
    .limit(50);

  if (error && /blogging_deadline_days|schema cache|column/i.test(error.message ?? "")) {
    const fallback = await supabase
      .from("product_releases")
      .select(
        "id,name,category,short_description,handwritten_note,editorial_image_url,image_url,vendor_poster_url,release_date,status,featured_on_landing,display_order,auto_archive_at",
      )
      .order("display_order", { ascending: true })
      .order("release_date", { ascending: false })
      .limit(50);

    if (fallback.error) throw fallback.error;
    const fallbackProducts = ((fallback.data ?? []) as Omit<ProductSummary, "blogging_deadline_days">[]).map((product) => ({
      ...product,
      blogging_deadline_days: null,
    })) as ProductSummary[];
    return withProductActivity(fallbackProducts);
  }

  if (error) throw error;
  return withProductActivity((data ?? []) as ProductSummary[]);
}

export async function getReviewQueue(status: SubmissionStatus | "all" = "all") {
  let query = supabase
    .from("blog_submissions")
    .select("id,product_id,blogger_id,status,blogger_note,review_comment,submitted_at")
    .order("submitted_at", { ascending: false })
    .limit(50);

  if (status !== "all") query = query.eq("status", status);

  const { data: submissions, error } = await query;
  if (error) throw error;

  const rows = submissions ?? [];
  const latestRowsByBloggerProduct = new Map<string, (typeof rows)[number]>();

  rows.forEach((row) => {
    const key = `${row.blogger_id}:${row.product_id}`;
    if (!latestRowsByBloggerProduct.has(key)) latestRowsByBloggerProduct.set(key, row);
  });

  const visibleRows = [...latestRowsByBloggerProduct.values()];
  if (visibleRows.length === 0) return [] as ReviewQueueItem[];

  const productIds = [...new Set(visibleRows.map((row) => row.product_id))];
  const bloggerIds = [...new Set(visibleRows.map((row) => row.blogger_id))];
  const submissionIds = visibleRows.map((row) => row.id);

  const [{ data: products }, { data: bloggers }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from("product_releases")
      .select("id,name,editorial_image_url,image_url")
      .in("id", productIds),
    supabase
      .from("profiles")
      .select("id,display_name,full_name,email,avatar_url,status_message,availability_status")
      .in("id", bloggerIds),
    supabase
      .from("blog_submission_links")
      .select("id,submission_id,platform,url,note,sort_order")
      .in("submission_id", submissionIds)
      .order("sort_order", { ascending: true }),
  ]);

  if (linksError) throw linksError;

  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const bloggerMap = new Map((bloggers ?? []).map((blogger) => [blogger.id, blogger]));
  const linksBySubmission = (links ?? []).reduce<Record<string, ReviewQueueItem["links"]>>((acc, link) => {
    if (!acc[link.submission_id]) acc[link.submission_id] = [];
    acc[link.submission_id].push({
      id: link.id,
      platform: link.platform,
      url: link.url,
      note: link.note,
      sort_order: link.sort_order,
    });
    return acc;
  }, {});

  return visibleRows.map((row) => {
    const product = productMap.get(row.product_id);
    const blogger = bloggerMap.get(row.blogger_id);
    const rowLinks = linksBySubmission[row.id] ?? [];
    return {
      id: row.id,
      status: row.status,
      submitted_at: row.submitted_at,
      review_comment: row.review_comment,
      blogger_note: row.blogger_note,
      product_id: row.product_id,
      product_name: product?.name ?? "Unknown product",
      product_image: product?.editorial_image_url ?? product?.image_url ?? null,
      blogger_id: row.blogger_id,
      blogger_name: blogger?.display_name ?? blogger?.full_name ?? blogger?.email ?? "Unknown blogger",
      blogger_avatar_url: blogger?.avatar_url ?? null,
      blogger_status_message: blogger?.status_message ?? null,
      blogger_availability_status: blogger?.availability_status ?? null,
      links_count: rowLinks.length,
      links: rowLinks,
    } satisfies ReviewQueueItem;
  });
}

export async function getDeliveryDeskClaims() {
  const { data: claims, error } = await supabase
    .from("product_claims")
    .select("id,product_id,blogger_id,status,delivery_response,claimed_at,delivered_at")
    .order("claimed_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  const rows = (claims ?? []) as ProductClaim[];
  if (rows.length === 0) return [] as DeliveryDeskItem[];

  const productIds = [...new Set(rows.map((row) => row.product_id))];
  const bloggerIds = [...new Set(rows.map((row) => row.blogger_id))];

  const [{ data: products, error: productError }, { data: bloggers, error: bloggerError }] = await Promise.all([
    supabase
      .from("product_releases")
      .select("id,name,editorial_image_url,image_url,delivery_item_key")
      .in("id", productIds),
    supabase
      .from("profiles")
      .select("id,display_name,full_name,email,sl_avatar_uuid,sl_avatar_name")
      .in("id", bloggerIds),
  ]);

  if (productError) throw productError;
  if (bloggerError) throw bloggerError;

  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const bloggerMap = new Map((bloggers ?? []).map((blogger) => [blogger.id, blogger]));

  return rows.map((row) => {
    const product = productMap.get(row.product_id);
    const blogger = bloggerMap.get(row.blogger_id);

    return {
      ...row,
      product_name: product?.name ?? "Unknown product",
      product_image: product?.editorial_image_url ?? product?.image_url ?? null,
      delivery_item_key: product?.delivery_item_key ?? null,
      blogger_name: blogger?.display_name ?? blogger?.full_name ?? blogger?.email ?? "Unknown blogger",
      blogger_avatar_uuid: blogger?.sl_avatar_uuid ?? null,
      blogger_avatar_name: blogger?.sl_avatar_name ?? null,
    } satisfies DeliveryDeskItem;
  });
}

export async function retryDeliveryClaim(claimId: string) {
  const { data, error } = await supabase.functions.invoke("admin-deliver-product", {
    body: { claimId },
  });

  if (error) {
    const details = await getFunctionErrorMessage(error);
    throw new Error(details);
  }

  void logAuditEvent({
    action: "Retried Second Life delivery",
    targetType: "claim",
    targetId: claimId,
    metadata: {
      delivered: Boolean((data as { delivered?: boolean } | null)?.delivered),
    },
  });

  return (data ?? {}) as {
    delivered?: boolean;
    message?: string;
    claim?: Pick<ProductClaim, "id" | "status" | "delivery_response" | "delivered_at">;
  };
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
        // Keep the generic message below.
      }
    }
  }

  return error instanceof Error ? error.message : "Could not retry delivery.";
}

export async function reviewSubmission(input: {
  submissionId: string;
  status: SubmissionStatus;
  reviewComment: string | null;
  reviewedBy: string;
}) {
  const { error } = await supabase
    .from("blog_submissions")
    .update({
      status: input.status,
      review_comment: input.reviewComment,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.submissionId);

  if (error) throw error;

  void logAuditEvent({
    action: formatReviewAction(input.status),
    targetType: "submission",
    targetId: input.submissionId,
    metadata: {
      status: input.status,
      review_comment: input.reviewComment,
      reviewed_by: input.reviewedBy,
    },
  });
}

function formatReviewAction(status: SubmissionStatus) {
  if (status === "approved") return "Approved blogger submission";
  if (status === "needs_revision") return "Requested submission revision";
  if (status === "rejected") return "Rejected blogger submission";
  return "Updated blogger submission";
}

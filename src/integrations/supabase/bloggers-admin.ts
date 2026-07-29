import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/integrations/supabase/audit-log";
import { getBloggerRejoinHistory, notifyStaffAboutRejoinAttempt } from "@/integrations/supabase/blogger-rejoin";
import type {
  AccountStatus,
  AvailabilityStatus,
  BloggerTier,
  ClaimStatus,
  ProductRelease,
  Profile,
  SubmissionStatus,
} from "@/integrations/supabase/database.types";

export type BloggerListItem = Pick<
  Profile,
  | "id"
  | "email"
  | "display_name"
  | "full_name"
  | "sl_avatar_name"
  | "language_preference"
  | "account_status"
  | "availability_status"
  | "blogger_tier"
  | "created_at"
  | "sl_avatar_uuid"
> & {
  progress?: BloggerProgressSummary;
};

export type BloggerProgressSummary = {
  claims: number;
  delivered: number;
  posts: number;
  approved: number;
  pending: number;
  needsRevision: number;
  approvedThisMonth: number;
};

const BLOGGER_SELECT =
  "id,email,display_name,full_name,sl_avatar_name,language_preference,account_status,availability_status,blogger_tier,created_at,sl_avatar_uuid";

type CreateBloggerAccountResponse = {
  ok?: boolean;
  userId?: string;
  profile?: BloggerListItem;
  message?: string;
};

type ProductPreview = Pick<ProductRelease, "name" | "editorial_image_url" | "image_url" | "vendor_poster_url"> | null;

export type BloggerDossierClaim = {
  id: string;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  status: ClaimStatus;
  claimed_at: string;
  delivered_at: string | null;
};

export type BloggerDossierSubmission = {
  id: string;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  reviewed_at: string | null;
  review_comment: string | null;
  links_count: number;
};

export type BloggerDossier = {
  claims: BloggerDossierClaim[];
  submissions: BloggerDossierSubmission[];
};

export async function listBloggers() {
  const { data, error } = await supabase
    .from("profiles")
    .select(BLOGGER_SELECT)
    .eq("role", "blogger")
    .order("created_at", { ascending: false });

  if (error) throw describeBloggerProfileError(error);
  const rows = (data ?? []) as BloggerListItem[];
  const progress = await getBloggerProgressSummaries(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...row,
    progress: progress[row.id] ?? createEmptyProgress(),
  }));
}

export async function createBloggerAccount(input: {
  email: string;
  password: string;
  displayName: string;
  avatarName: string;
  avatarUuid: string | null;
  language: "en" | "es";
  accountStatus: "pending" | "active";
  bloggerTier?: BloggerTier;
}) {
  const rejoinHistory = await getBloggerRejoinHistory(input.avatarUuid);
  if (rejoinHistory && rejoinHistory.totalSignals > 0) {
    await notifyStaffAboutRejoinAttempt({
      slAvatarUuid: input.avatarUuid,
      displayName: input.displayName.trim(),
      source: "account_creation",
    });
    throw new Error(
      `This SL avatar UUID belongs to someone who already left the blogger program ${rejoinHistory.totalSignals} time${rejoinHistory.totalSignals === 1 ? "" : "s"}. Review before creating a new account.`,
    );
  }

  const { data, error } = await supabase.functions.invoke<CreateBloggerAccountResponse>(
    "create-blogger-account",
    {
      body: {
        email: input.email.trim().toLowerCase(),
        password: input.password,
        displayName: input.displayName.trim(),
        avatarName: input.avatarName.trim(),
        avatarUuid: input.avatarUuid,
        language: input.language,
        accountStatus: input.accountStatus,
        bloggerTier: input.bloggerTier ?? "standard",
      },
    },
  );

  if (error) throw new Error(await describeFunctionError(error, "Could not create blogger account."));
  if (!data?.ok || !data.userId || !data.profile) {
    throw new Error(data?.message || "Could not create blogger account.");
  }

  return { userId: data.userId, profile: data.profile };
}

export async function findBloggerAccountForApplication(input: {
  email?: string | null;
  avatarUuid?: string | null;
  avatarName?: string | null;
}) {
  const email = input.email?.trim().toLowerCase();
  const avatarUuid = input.avatarUuid?.trim().toLowerCase();
  const avatarName = input.avatarName?.trim();

  const clauses = [
    avatarUuid ? `sl_avatar_uuid.eq.${avatarUuid}` : null,
    email ? `email.eq.${email}` : null,
    !avatarUuid && !email && avatarName ? `sl_avatar_name.eq.${avatarName}` : null,
  ].filter(Boolean);

  if (clauses.length === 0) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(BLOGGER_SELECT)
    .eq("role", "blogger")
    .or(clauses.join(","))
    .limit(1)
    .maybeSingle<BloggerListItem>();

  if (error) throw describeBloggerProfileError(error);
  return data ?? null;
}

async function describeFunctionError(error: unknown, fallback: string) {
  const response = getFunctionErrorResponse(error);
  if (response) {
    try {
      const body = await response.clone().json();
      if (typeof body?.message === "string" && body.message.trim()) return body.message.trim();
      if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
    } catch {
      try {
        const text = await response.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // Keep the friendly fallback below.
      }
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

function getFunctionErrorResponse(error: unknown): Response | null {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  return context instanceof Response ? context : null;
}

export async function updateBloggerAccountStatus(bloggerId: string, accountStatus: AccountStatus) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      account_status: accountStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bloggerId)
    .eq("role", "blogger")
    .select(
      BLOGGER_SELECT,
    )
    .single<BloggerListItem>();

  if (error) throw describeBloggerProfileError(error);

  void logAuditEvent({
    action: `Set blogger account to ${accountStatus}`,
    targetType: "profile",
    targetId: data.id,
    targetName: data.display_name ?? data.full_name ?? data.email,
    metadata: { account_status: accountStatus },
  });

  return data;
}

export async function removeBloggerAccount(bloggerId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      account_status: "blocked",
      availability_status: "offline",
      updated_at: new Date().toISOString(),
    })
    .eq("id", bloggerId)
    .eq("role", "blogger")
    .select(BLOGGER_SELECT)
    .single<BloggerListItem>();

  if (error) throw describeBloggerProfileError(error);

  void logAuditEvent({
    action: "Removed blogger account",
    targetType: "profile",
    targetId: data.id,
    targetName: data.display_name ?? data.full_name ?? data.email,
    metadata: { account_status: "blocked", removal_source: "staff" },
  });

  return data;
}

export async function updateBloggerDetails(input: {
  bloggerId: string;
  displayName: string;
  avatarName: string;
  avatarUuid: string | null;
  language: "en" | "es";
  accountStatus: AccountStatus;
  availabilityStatus: AvailabilityStatus;
  bloggerTier: BloggerTier;
}) {
  const displayName = input.displayName.trim();
  const avatarName = input.avatarName.trim();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      full_name: displayName,
      sl_avatar_name: avatarName,
      sl_legacy_name: avatarName,
      sl_display_name: avatarName,
      sl_avatar_uuid: input.avatarUuid,
      language_preference: input.language,
      account_status: input.accountStatus,
      availability_status: input.availabilityStatus,
      blogger_tier: input.bloggerTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bloggerId)
    .eq("role", "blogger")
    .select(BLOGGER_SELECT)
    .single<BloggerListItem>();

  if (error) throw error;

  void logAuditEvent({
    action: "Updated blogger dossier",
    targetType: "profile",
    targetId: data.id,
    targetName: data.display_name ?? data.full_name ?? data.email,
    metadata: {
      sl_avatar_name: data.sl_avatar_name,
      sl_avatar_uuid: data.sl_avatar_uuid,
      account_status: data.account_status,
      availability_status: data.availability_status,
      blogger_tier: data.blogger_tier,
      language: data.language_preference,
    },
  });

  return data;
}

function describeBloggerProfileError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  ) {
    return new Error("This SL avatar UUID is already connected to another profile.");
  }

  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return new Error(message);
  }
  return new Error("Could not save blogger profile.");
}

export async function getBloggerDossier(bloggerId: string): Promise<BloggerDossier> {
  const [claimsResult, submissionsResult] = await Promise.all([
    supabase
      .from("product_claims")
      .select("id,product_id,status,claimed_at,delivered_at,product_releases(name,editorial_image_url,image_url,vendor_poster_url)")
      .eq("blogger_id", bloggerId)
      .order("claimed_at", { ascending: false })
      .limit(8),
    supabase
      .from("blog_submissions")
      .select(
        "id,product_id,status,submitted_at,reviewed_at,review_comment,blog_submission_links(id),product_releases(name,editorial_image_url,image_url,vendor_poster_url)",
      )
      .eq("blogger_id", bloggerId)
      .order("submitted_at", { ascending: false })
      .limit(8),
  ]);

  if (claimsResult.error) throw claimsResult.error;
  if (submissionsResult.error) throw submissionsResult.error;

  const claims = ((claimsResult.data ?? []) as Array<{
    id: string;
    product_id: string;
    status: ClaimStatus;
    claimed_at: string;
    delivered_at: string | null;
    product_releases?: ProductPreview;
  }>).map((row) => ({
    id: row.id,
    product_id: row.product_id,
    product_name: row.product_releases?.name ?? "Untitled product",
    product_image_url: getProductPreviewImage(row.product_releases),
    status: row.status,
    claimed_at: row.claimed_at,
    delivered_at: row.delivered_at,
  }));

  const submissions = ((submissionsResult.data ?? []) as Array<{
    id: string;
    product_id: string;
    status: SubmissionStatus;
    submitted_at: string;
    reviewed_at: string | null;
    review_comment: string | null;
    blog_submission_links?: Array<{ id: string }>;
    product_releases?: ProductPreview;
  }>).map((row) => ({
    id: row.id,
    product_id: row.product_id,
    product_name: row.product_releases?.name ?? "Untitled product",
    product_image_url: getProductPreviewImage(row.product_releases),
    status: row.status,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    review_comment: row.review_comment,
    links_count: row.blog_submission_links?.length ?? 0,
  }));

  return { claims, submissions };
}

function getProductPreviewImage(product: ProductPreview) {
  return product?.editorial_image_url ?? product?.image_url ?? product?.vendor_poster_url ?? null;
}

async function getBloggerProgressSummaries(bloggerIds: string[]) {
  const summaries = bloggerIds.reduce<Record<string, BloggerProgressSummary>>((acc, id) => {
    acc[id] = createEmptyProgress();
    return acc;
  }, {});

  if (bloggerIds.length === 0) return summaries;

  const [claimsResult, submissionsResult] = await Promise.all([
    supabase
      .from("product_claims")
      .select("blogger_id,status")
      .in("blogger_id", bloggerIds),
    supabase
      .from("blog_submissions")
      .select("blogger_id,status,submitted_at,reviewed_at")
      .in("blogger_id", bloggerIds),
  ]);

  if (claimsResult.error) throw claimsResult.error;
  if (submissionsResult.error) throw submissionsResult.error;

  for (const claim of (claimsResult.data ?? []) as Array<{ blogger_id: string; status: ClaimStatus }>) {
    const summary = summaries[claim.blogger_id];
    if (!summary) continue;
    summary.claims += 1;
    if (claim.status === "delivered") summary.delivered += 1;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  for (const submission of (submissionsResult.data ?? []) as Array<{
    blogger_id: string;
    status: SubmissionStatus;
    submitted_at: string;
    reviewed_at: string | null;
  }>) {
    const summary = summaries[submission.blogger_id];
    if (!summary) continue;
    summary.posts += 1;
    if (submission.status === "approved") {
      summary.approved += 1;
      const acceptedAt = new Date(submission.reviewed_at ?? submission.submitted_at);
      if (!Number.isNaN(acceptedAt.getTime()) && acceptedAt >= monthStart) {
        summary.approvedThisMonth += 1;
      }
    }
    if (submission.status === "pending") summary.pending += 1;
    if (submission.status === "needs_revision") summary.needsRevision += 1;
  }

  return summaries;
}

function createEmptyProgress(): BloggerProgressSummary {
  return {
    claims: 0,
    delivered: 0,
    posts: 0,
    approved: 0,
    pending: 0,
    needsRevision: 0,
    approvedThisMonth: 0,
  };
}

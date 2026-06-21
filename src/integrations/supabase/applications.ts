import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/integrations/supabase/audit-log";
import { notifyStaffAboutRejoinAttempt } from "@/integrations/supabase/blogger-rejoin";
import type { BloggerApplication } from "@/integrations/supabase/database.types";

export type ApplicationStatus = BloggerApplication["status"];

export type ApplicationInput = {
  displayName: string;
  email: string;
  slAvatarName: string;
  slAvatarUuid?: string;
  languagePreference: "en" | "es";
  flickrUrl?: string;
  instagramUrl?: string;
  blogUrl?: string;
  answers: Record<string, string>;
};

export async function submitBloggerApplication(input: ApplicationInput) {
  const payload = {
    display_name: input.displayName.trim(),
    email: input.email.trim().toLowerCase(),
    sl_avatar_name: input.slAvatarName.trim() || null,
    sl_avatar_uuid: input.slAvatarUuid?.trim() || null,
    language_preference: input.languagePreference,
    flickr_url: input.flickrUrl?.trim() || null,
    instagram_url: input.instagramUrl?.trim() || null,
    blog_url: input.blogUrl?.trim() || null,
    answers: input.answers,
    status: "pending" as const,
  };

  const { data, error } = await supabase
    .from("blogger_applications")
    .insert(payload)
    .select(
      "id,display_name,email,sl_avatar_name,sl_avatar_uuid,language_preference,flickr_url,instagram_url,blog_url,answers,status,reviewed_by,review_comment,submitted_at,reviewed_at",
    )
    .single<BloggerApplication>();

  if (error) throw error;

  void notifyStaffAboutRejoinAttempt({
    slAvatarUuid: data.sl_avatar_uuid,
    displayName: data.display_name,
    source: "application",
    applicationId: data.id,
  });

  return data;
}

export async function listBloggerApplications(status: ApplicationStatus | "all" = "pending") {
  let query = supabase
    .from("blogger_applications")
    .select(
      "id,display_name,email,sl_avatar_name,sl_avatar_uuid,language_preference,flickr_url,instagram_url,blog_url,answers,status,reviewed_by,review_comment,submitted_at,reviewed_at",
    )
    .order("submitted_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BloggerApplication[];
}

export async function reviewBloggerApplication(input: {
  applicationId: string;
  status: Exclude<ApplicationStatus, "pending">;
  reviewComment?: string | null;
  reviewedBy: string;
}) {
  const { data, error } = await supabase
    .from("blogger_applications")
    .update({
      status: input.status,
      review_comment: input.reviewComment?.trim() || null,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.applicationId)
    .select(
      "id,display_name,email,sl_avatar_name,sl_avatar_uuid,language_preference,flickr_url,instagram_url,blog_url,answers,status,reviewed_by,review_comment,submitted_at,reviewed_at",
    )
    .single<BloggerApplication>();

  if (error) throw error;

  void logAuditEvent({
    action: input.status === "approved" ? "Approved blogger application" : "Rejected blogger application",
    targetType: "blogger_application",
    targetId: data.id,
    targetName: data.display_name,
    metadata: {
      email: data.email,
      sl_avatar_name: data.sl_avatar_name,
      status: input.status,
    },
  });

  return data;
}

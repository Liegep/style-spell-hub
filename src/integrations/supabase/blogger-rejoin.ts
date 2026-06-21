import { supabase } from "@/integrations/supabase/client";
import { createStaffInAppNotification } from "@/integrations/supabase/notifications";

export type BloggerRejoinHistory = {
  slAvatarUuid: string;
  leftProfiles: number;
  leaveEvents: number;
  totalSignals: number;
};

export async function getBloggerRejoinHistory(slAvatarUuid?: string | null): Promise<BloggerRejoinHistory | null> {
  const uuid = slAvatarUuid?.trim();
  if (!uuid) return null;

  const [profilesResult, auditsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "blogger")
      .eq("account_status", "left")
      .eq("sl_avatar_uuid", uuid),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "Blogger left platform")
      .contains("metadata", { sl_avatar_uuid: uuid }),
  ]);

  if (profilesResult.error || auditsResult.error) {
    console.warn("[Blogger Rejoin] Could not read rejoin history.", profilesResult.error ?? auditsResult.error);
    return null;
  }

  const leftProfiles = profilesResult.count ?? 0;
  const leaveEvents = auditsResult.count ?? 0;
  return {
    slAvatarUuid: uuid,
    leftProfiles,
    leaveEvents,
    totalSignals: Math.max(leftProfiles, leaveEvents),
  };
}

export async function notifyStaffAboutRejoinAttempt(input: {
  slAvatarUuid?: string | null;
  displayName: string;
  source: "application" | "account_creation";
  applicationId?: string;
}) {
  const history = await getBloggerRejoinHistory(input.slAvatarUuid);
  if (!history || history.totalSignals === 0) return history;

  const sourceLabel = input.source === "application" ? "application" : "account creation";
  await createStaffInAppNotification({
    title: "Returning blogger needs review",
    body: `${input.displayName} is using an SL UUID that already left the blogger program ${history.totalSignals} time${history.totalSignals === 1 ? "" : "s"}. Source: ${sourceLabel}.`,
    actionUrl: "/app/applications",
    metadata: {
      source: "blogger_rejoin_attempt",
      rejoin_source: input.source,
      application_id: input.applicationId ?? null,
      sl_avatar_uuid: history.slAvatarUuid,
      previous_leave_count: history.totalSignals,
    },
  });

  return history;
}

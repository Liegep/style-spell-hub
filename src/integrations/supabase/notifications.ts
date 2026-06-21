import { supabase } from "@/integrations/supabase/client";
import type {
  NotificationQueue,
  NotificationType,
  Profile,
} from "@/integrations/supabase/database.types";

export type AppNotification = Pick<
  NotificationQueue,
  | "id"
  | "channel"
  | "type"
  | "title"
  | "body"
  | "action_url"
  | "metadata"
  | "status"
  | "read_at"
  | "created_at"
  | "sent_at"
>;

type NotificationInput = {
  recipientId: string;
  type?: NotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
};

type BloggerRecipient = Pick<Profile, "id">;

function isMissingReadAtError(error: { message?: string; details?: string } | null) {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`;
  return /read_at|schema cache|column/i.test(text);
}

export async function listMyNotifications(profileId: string, limit = 50) {
  const { data, error } = await supabase
    .from("notification_queue")
    .select("id,channel,type,title,body,action_url,metadata,status,read_at,created_at,sent_at")
    .eq("recipient_id", profileId)
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    const message = error.message ?? "";
    if (/read_at|schema cache|column/i.test(message)) {
      const fallback = await supabase
        .from("notification_queue")
        .select("id,channel,type,title,body,action_url,metadata,status,created_at,sent_at")
        .eq("recipient_id", profileId)
        .eq("channel", "in_app")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((row) => ({
        ...row,
        read_at: row.status === "sent" ? row.sent_at ?? row.created_at : null,
      })) as AppNotification[];
    }

    throw error;
  }
  return (data ?? []) as AppNotification[];
}

export async function countMyUnreadNotifications(profileId: string) {
  if (!profileId) return 0;
  return 0;
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase.rpc("mark_my_notification_read", {
    target_notification_id: notificationId,
  });
  if (isMissingReadAtError(error)) {
    console.warn("[Notifications] mark read skipped because read_at is not available yet.", error);
    return;
  }
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc("mark_my_notifications_read");
  if (isMissingReadAtError(error)) {
    console.warn("[Notifications] mark all read skipped because read_at is not available yet.", error);
    return;
  }
  if (error) throw error;
}

export async function createInAppNotification(input: NotificationInput) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("notification_queue").insert({
    recipient_id: input.recipientId,
    recipient_sl_uuid: null,
    channel: "in_app",
    type: input.type ?? "manual",
    title: input.title.trim(),
    body: input.body.trim(),
    action_url: input.actionUrl?.trim() || null,
    metadata: input.metadata ?? {},
    status: "sent",
    scheduled_at: now,
    sent_at: now,
  });

  if (error) throw error;
  window.dispatchEvent(new Event("notifications-updated"));
}

export async function createBroadcastInAppNotification(input: Omit<NotificationInput, "recipientId">) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "blogger")
    .eq("account_status", "active");

  if (error) throw error;

  const recipients = (data ?? []) as BloggerRecipient[];
  if (recipients.length === 0) return;

  const now = new Date().toISOString();
  const payload = recipients.map((recipient) => ({
    recipient_id: recipient.id,
    recipient_sl_uuid: null,
    channel: "in_app" as const,
    type: input.type ?? "manual",
    title: input.title.trim(),
    body: input.body.trim(),
    action_url: input.actionUrl?.trim() || null,
    metadata: input.metadata ?? {},
    status: "sent" as const,
    scheduled_at: now,
    sent_at: now,
  }));

  const { error: insertError } = await supabase.from("notification_queue").insert(payload);
  if (insertError) throw insertError;
  window.dispatchEvent(new Event("notifications-updated"));
}

export async function createStaffInAppNotification(input: Omit<NotificationInput, "recipientId">) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "super_admin"])
    .neq("account_status", "left");

  if (error) throw error;

  const recipients = (data ?? []) as BloggerRecipient[];
  if (recipients.length === 0) return;

  const now = new Date().toISOString();
  const payload = recipients.map((recipient) => ({
    recipient_id: recipient.id,
    recipient_sl_uuid: null,
    channel: "in_app" as const,
    type: input.type ?? "manual",
    title: input.title.trim(),
    body: input.body.trim(),
    action_url: input.actionUrl?.trim() || null,
    metadata: input.metadata ?? {},
    status: "sent" as const,
    scheduled_at: now,
    sent_at: now,
  }));

  const { error: insertError } = await supabase.from("notification_queue").insert(payload);
  if (insertError) throw insertError;
  window.dispatchEvent(new Event("notifications-updated"));
}

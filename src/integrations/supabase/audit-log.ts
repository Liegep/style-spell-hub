import { supabase } from "@/integrations/supabase/client";
import type {
  AppRole,
  AuditLog,
  NotificationQueue,
  NotificationStatus,
  Profile,
} from "@/integrations/supabase/database.types";

export type AuditEventInput = {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  metadata?: Record<string, unknown>;
};

type AuditActor = Pick<Profile, "id" | "display_name" | "full_name" | "email" | "role">;

export type NotificationQueueWithRecipient = NotificationQueue & {
  recipientName: string | null;
  recipientAvatarName: string | null;
};

export type NotificationHealth = {
  latest: NotificationQueueWithRecipient[];
  counts: Record<NotificationStatus, number>;
  duePending: number;
  latestSentAt: string | null;
  latestFailedAt: string | null;
  latestProcessedAt: string | null;
  oldestDuePendingAt: string | null;
};

export async function listAuditLogs(limit = 80) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,actor_id,actor_name,actor_role,action,target_type,target_id,target_name,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AuditLog[];
}

export async function getNotificationHealth(): Promise<NotificationHealth> {
  const [latest, pending, sent, failed, cancelled, duePending, oldestDuePending, latestSent, latestFailed] =
    await Promise.all([
      supabase
        .from("notification_queue")
        .select(
          "id,recipient_id,recipient_sl_uuid,delivery_server_url,channel,type,title,body,action_url,metadata,status,attempts,last_error,scheduled_at,sent_at,created_at,updated_at",
        )
        .eq("channel", "second_life")
        .order("created_at", { ascending: false })
        .limit(12),
      countNotifications("pending"),
      countNotifications("sent"),
      countNotifications("failed"),
      countNotifications("cancelled"),
      supabase
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("channel", "second_life")
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString()),
      supabase
        .from("notification_queue")
        .select("scheduled_at")
        .eq("channel", "second_life")
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle<{ scheduled_at: string | null }>(),
      supabase
        .from("notification_queue")
        .select("sent_at")
        .eq("channel", "second_life")
        .eq("status", "sent")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ sent_at: string | null }>(),
      supabase
        .from("notification_queue")
        .select("updated_at")
        .eq("channel", "second_life")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ updated_at: string | null }>(),
    ]);

  if (latest.error) throw latest.error;
  if (duePending.error) throw duePending.error;
  if (oldestDuePending.error) throw oldestDuePending.error;
  if (latestSent.error) throw latestSent.error;
  if (latestFailed.error) throw latestFailed.error;

  const latestRows = (latest.data ?? []) as NotificationQueue[];
  const recipientIds = Array.from(
    new Set(latestRows.map((row) => row.recipient_id).filter((id): id is string => Boolean(id))),
  );
  const recipientProfiles =
    recipientIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id,display_name,full_name,email,sl_avatar_name")
          .in("id", recipientIds)
      : null;

  if (recipientProfiles?.error) throw recipientProfiles.error;

  const recipientsById = new Map(
    ((recipientProfiles?.data ?? []) as Array<
      Pick<Profile, "id" | "display_name" | "full_name" | "email" | "sl_avatar_name">
    >).map((profile) => [profile.id, profile]),
  );
  const latestWithRecipients: NotificationQueueWithRecipient[] = latestRows.map((row) => {
    const recipient = row.recipient_id ? recipientsById.get(row.recipient_id) : null;
    return {
      ...row,
      recipientName: recipient?.display_name || recipient?.full_name || recipient?.email || null,
      recipientAvatarName: recipient?.sl_avatar_name ?? null,
    };
  });

  const processedDates = [latestSent.data?.sent_at, latestFailed.data?.updated_at]
    .filter(Boolean)
    .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime());

  return {
    latest: latestWithRecipients,
    counts: {
      pending,
      sent,
      failed,
      cancelled,
    },
    duePending: duePending.count ?? 0,
    latestSentAt: latestSent.data?.sent_at ?? null,
    latestFailedAt: latestFailed.data?.updated_at ?? null,
    latestProcessedAt: processedDates[0] ?? null,
    oldestDuePendingAt: oldestDuePending.data?.scheduled_at ?? null,
  };
}

export async function processSecondLifeNotificationsNow() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!supabaseUrl || !supabaseAnonKey || !session?.access_token) {
    throw new Error("Supabase is not configured for Second Life notification processing.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-sl-notification`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ processDue: true }),
  });

  const text = await response.text();
  let result: { sent?: boolean; message?: string; processed?: number } | null = null;

  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    result = { sent: false, message: text };
  }

  if (!response.ok || result?.sent === false) {
    throw new Error(result?.message || `Second Life processing failed with status ${response.status}.`);
  }

  return Number(result?.processed ?? 0);
}

export async function processSecondLifeNotificationById(queueId: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!supabaseUrl || !supabaseAnonKey || !session?.access_token) {
    throw new Error("Supabase is not configured for Second Life notification processing.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-sl-notification`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ queueId }),
  });

  const text = await response.text();
  let result: { sent?: boolean; message?: string; notificationId?: string } | null = null;

  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    result = { sent: false, message: text };
  }

  if (!response.ok || result?.sent === false) {
    throw new Error(result?.message || `Second Life notification failed with status ${response.status}.`);
  }

  return result;
}

export async function queueWarningNotificationsNow() {
  const { data, error } = await supabase.rpc("staff_queue_warning_notifications");
  if (error) throw error;
  return (data ?? []) as Array<{ warning_kind: string; queued_count: number }>;
}

export async function sendSecondLifePulseTest() {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("You must be logged in to test Second Life notifications.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,display_name,sl_avatar_uuid")
    .eq("id", userId)
    .maybeSingle<Pick<Profile, "id" | "display_name" | "sl_avatar_uuid">>();

  if (profileError) throw profileError;
  if (!profile?.sl_avatar_uuid) {
    throw new Error("Your profile needs an SL avatar UUID before testing Second Life IMs.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!supabaseUrl || !supabaseAnonKey || !session?.access_token) {
    throw new Error("Supabase is not configured for Second Life tests.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-sl-notification`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      recipientId: profile.id,
      type: "manual",
      title: "Love Potion pulse",
      body: `Automation pulse test for ${profile.display_name ?? "Love Potion HQ"}.`,
    }),
  });

  const responseText = await response.text();
  let result: { sent?: boolean; message?: string } | null = null;

  try {
    result = responseText ? (JSON.parse(responseText) as { sent?: boolean; message?: string }) : null;
  } catch {
    result = { sent: false, message: responseText };
  }

  if (!response.ok || result?.sent === false) {
    throw new Error(result?.message || `Second Life pulse failed with status ${response.status}.`);
  }

  return result;
}

export async function logAuditEvent(input: AuditEventInput) {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    const { data: actor, error: actorError } = await supabase
      .from("profiles")
      .select("id,display_name,full_name,email,role")
      .eq("id", userId)
      .maybeSingle<AuditActor>();

    if (actorError) throw actorError;

    const { error } = await supabase.from("audit_logs").insert({
      actor_id: userId,
      actor_name: actor ? formatActorName(actor) : null,
      actor_role: (actor?.role ?? null) as AppRole | null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      target_name: input.targetName ?? null,
      metadata: input.metadata ?? {},
    });

    if (error) throw error;
  } catch (error) {
    console.warn("[Audit Log] Could not record audit event.", error);
  }
}

function formatActorName(actor: AuditActor) {
  return actor.display_name || actor.full_name || actor.email || "Love Potion HQ";
}

async function countNotifications(status: NotificationStatus) {
  const { count, error } = await supabase
    .from("notification_queue")
    .select("id", { count: "exact", head: true })
    .eq("channel", "second_life")
    .eq("status", status);

  if (error) throw error;
  return count ?? 0;
}

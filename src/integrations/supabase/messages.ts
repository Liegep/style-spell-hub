import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/integrations/supabase/audit-log";
import { createBroadcastInAppNotification, createInAppNotification } from "@/integrations/supabase/notifications";
import type { InternalMessage, MessageScope, Profile } from "@/integrations/supabase/database.types";

export type InboxMessage = InternalMessage & {
  sender_name: string | null;
};

export type SentMessage = InternalMessage & {
  recipient_name: string | null;
};

export type MessageRecipient = Pick<Profile, "id" | "display_name" | "full_name" | "email" | "sl_avatar_name">;

export async function listInboxMessages(profileId: string) {
  const { data, error } = await supabase
    .from("internal_messages")
    .select("id,scope,sender_id,recipient_id,subject,body,image_url,read_at,created_at")
    .or(`scope.eq.broadcast,recipient_id.eq.${profileId}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const rows = (data ?? []) as InternalMessage[];
  const senderIds = [...new Set(rows.map((row) => row.sender_id).filter(Boolean))] as string[];
  if (senderIds.length === 0) {
    return rows.map((row) => ({ ...row, sender_name: null })) as InboxMessage[];
  }

  const { data: senders, error: senderError } = await supabase
    .from("profiles")
    .select("id,display_name,full_name,email")
    .in("id", senderIds);

  if (senderError) throw senderError;

  const senderMap = new Map(
    (senders ?? []).map((sender) => [
      sender.id,
      sender.display_name || sender.full_name || sender.email || "Love Potion HQ",
    ]),
  );

  return rows.map((row) => ({
    ...row,
    sender_name: row.sender_id ? senderMap.get(row.sender_id) ?? null : null,
  })) as InboxMessage[];
}

export async function listPersonalInboxMessages(profileId: string) {
  const { data, error } = await supabase
    .from("internal_messages")
    .select("id,scope,sender_id,recipient_id,subject,body,image_url,read_at,created_at")
    .eq("scope", "personal")
    .eq("recipient_id", profileId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  const rows = (data ?? []) as InternalMessage[];
  const senderIds = [...new Set(rows.map((row) => row.sender_id).filter(Boolean))] as string[];
  if (senderIds.length === 0) {
    return rows.map((row) => ({ ...row, sender_name: null })) as InboxMessage[];
  }

  const { data: senders, error: senderError } = await supabase
    .from("profiles")
    .select("id,display_name,full_name,email")
    .in("id", senderIds);

  if (senderError) throw senderError;

  const senderMap = new Map(
    (senders ?? []).map((sender) => [
      sender.id,
      sender.display_name || sender.full_name || sender.email || "Blogger",
    ]),
  );

  return rows.map((row) => ({
    ...row,
    sender_name: row.sender_id ? senderMap.get(row.sender_id) ?? null : null,
  })) as InboxMessage[];
}

export async function markPersonalInboxMessagesRead() {
  const { error } = await supabase.rpc("mark_my_internal_messages_read");
  if (error) throw error;
}

export async function markInternalMessageRead(messageId: string) {
  const { error } = await supabase
    .from("internal_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) throw error;
}

export async function listMessageRecipients() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,full_name,email,sl_avatar_name")
    .eq("role", "blogger")
    .order("display_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MessageRecipient[];
}

export async function sendInternalMessage(input: {
  senderId: string;
  scope: MessageScope;
  recipientId: string | null;
  subject: string;
  body: string;
}) {
  const localId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const message = {
    sender_id: input.senderId,
    scope: input.scope,
    recipient_id: input.scope === "personal" ? input.recipientId : null,
    subject: input.subject.trim(),
    body: input.body.trim() || null,
  };

  const { error } = await supabase.from("internal_messages").insert(message);

  if (error) throw error;

  void logAuditEvent({
    action: input.scope === "broadcast" ? "Sent broadcast message" : "Sent personal message",
    targetType: "message",
    targetId: localId,
    targetName: message.subject,
    metadata: {
      scope: input.scope,
      recipient_id: message.recipient_id,
    },
  });

  if (input.scope === "broadcast") {
    void createBroadcastInAppNotification({
      type: "new_message",
      title: message.subject,
      body: message.body || "New broadcast from Love Potion HQ.",
      actionUrl: "/app/blogger?section=inbox",
      metadata: { source: "internal_message", scope: input.scope },
    }).catch((error) => console.warn("[Messages] could not create broadcast notification", error));
  } else if (message.recipient_id) {
    void createInAppNotification({
      recipientId: message.recipient_id,
      type: "new_message",
      title: message.subject,
      body: message.body || "New personal message from Love Potion HQ.",
      actionUrl: "/app/blogger?section=inbox",
      metadata: { source: "internal_message", scope: input.scope },
    }).catch((error) => console.warn("[Messages] could not create personal notification", error));
  }

  return {
    id: localId,
    ...message,
    image_url: null,
    read_at: null,
    created_at: new Date().toISOString(),
  } satisfies InternalMessage;
}

export async function sendInternalReply(input: {
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
}) {
  const localId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const { data, error } = await supabase.rpc("send_internal_reply", {
    target_recipient_id: input.recipientId,
    reply_subject: input.subject.trim(),
    reply_body: input.body.trim(),
  });

  if (error) throw error;

  void logAuditEvent({
    action: "Replied to message",
    targetType: "message",
    targetId: typeof data === "string" ? data : localId,
    targetName: input.subject.trim(),
    metadata: {
      recipient_id: input.recipientId,
    },
  });

  void createInAppNotification({
    recipientId: input.recipientId,
    type: "new_message",
    title: input.subject.trim(),
    body: input.body.trim(),
    actionUrl: "/app/admin?section=inbox",
    metadata: { source: "internal_reply" },
  }).catch((error) => console.warn("[Messages] could not create reply notification", error));

  return {
    id: typeof data === "string" ? data : localId,
    sender_id: input.senderId,
    scope: "personal",
    recipient_id: input.recipientId,
    subject: input.subject.trim(),
    body: input.body.trim(),
    image_url: null,
    read_at: null,
    created_at: new Date().toISOString(),
  } satisfies InternalMessage;
}

export async function sendSecondLifeNotification(input: {
  recipientId: string;
  title: string;
  body: string;
  type?: string;
  actionUrl?: string | null;
}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!supabaseUrl || !supabaseAnonKey || !session?.access_token) {
    throw new Error("You must be logged in to send a Second Life notification.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-sl-notification`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      recipientId: input.recipientId,
      type: input.type ?? "manual",
      title: input.title.trim(),
      body: input.body.trim(),
      actionUrl: input.actionUrl?.trim() || null,
    }),
  });

  let result: { sent?: boolean; message?: string } | null = null;
  const responseText = await response.text();

  try {
    result = responseText ? (JSON.parse(responseText) as { sent?: boolean; message?: string }) : null;
  } catch {
    result = { sent: false, message: responseText };
  }

  if (!response.ok) {
    throw new Error(result?.message || `Second Life notification failed with status ${response.status}.`);
  }

  if (result?.sent === false) {
    throw new Error(result.message || "Could not send the Second Life notification.");
  }

  return result;
}

export async function notifySecondLifeQuietly(
  input: Parameters<typeof sendSecondLifeNotification>[0],
  context = "Second Life notification",
) {
  try {
    await sendSecondLifeNotification(input);
  } catch (error) {
    console.warn(`[${context}] skipped`, error);
  }
}

export async function notifyStaffSecondLifeQuietly(input: {
  title: string;
  body: string;
  type?: string;
  actionUrl?: string | null;
}) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["admin", "super_admin"])
      .neq("account_status", "left");

    if (error) throw error;

    await Promise.all(
      (data ?? []).map((recipient) =>
        notifySecondLifeQuietly(
          {
            recipientId: recipient.id,
            type: input.type ?? "manual",
            title: input.title,
            body: input.body,
            actionUrl: input.actionUrl ?? null,
          },
          "Staff Second Life notification",
        ),
      ),
    );
  } catch (error) {
    console.warn("[Staff Second Life notification] skipped", error);
  }
}

export async function listRecentSentMessages(senderId: string) {
  const { data, error } = await supabase
    .from("internal_messages")
    .select("id,scope,sender_id,recipient_id,subject,body,image_url,read_at,created_at")
    .eq("sender_id", senderId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  const rows = (data ?? []) as InternalMessage[];
  const recipientIds = [...new Set(rows.map((row) => row.recipient_id).filter(Boolean))] as string[];
  if (recipientIds.length === 0) {
    return rows.map((row) => ({ ...row, recipient_name: null })) as SentMessage[];
  }

  const { data: recipients, error: recipientError } = await supabase
    .from("profiles")
    .select("id,display_name,full_name,email")
    .in("id", recipientIds);

  if (recipientError) throw recipientError;

  const recipientMap = new Map(
    (recipients ?? []).map((recipient) => [
      recipient.id,
      recipient.display_name || recipient.full_name || recipient.email || "Blogger",
    ]),
  );

  return rows.map((row) => ({
    ...row,
    recipient_name: row.recipient_id ? recipientMap.get(row.recipient_id) ?? null : null,
  })) as SentMessage[];
}

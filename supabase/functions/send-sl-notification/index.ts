import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NotificationRequest = {
  queueId?: string;
  recipientId?: string;
  recipientSlUuid?: string;
  type?: string;
  title?: string;
  body?: string;
  actionUrl?: string;
  imageUrl?: string;
  fallbackUrl?: string;
  textureItemName?: string;
  metadata?: Record<string, unknown>;
};

type SupabaseClient = ReturnType<typeof createClient>;
type QueueItem = Record<string, unknown>;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function metadataText(metadata: unknown, key: string) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    return "";
  }

  return clean((metadata as Record<string, unknown>)[key]);
}

function appendFallbackLink(body: string, fallbackUrl: string) {
  if (!fallbackUrl || body.includes(fallbackUrl)) {
    return body;
  }

  return `${body}${body ? "\n\n" : ""}Image: ${fallbackUrl}`;
}

async function canReachUrl(url: string) {
  if (!url) {
    return false;
  }

  try {
    const response = await fetch(url, { method: "HEAD" });
    if (response.ok) {
      return true;
    }

    if (response.status === 405) {
      const getResponse = await fetch(url, {
        method: "GET",
        headers: { range: "bytes=0-0" },
      });
      return getResponse.ok || getResponse.status === 206;
    }
  } catch {
    return false;
  }

  return false;
}

function isCronRequest(request: Request) {
  const cronSecret = Deno.env.get("NOTIFICATION_CRON_SECRET");
  const requestSecret = request.headers.get("x-love-potion-cron-secret") ?? "";

  return Boolean(cronSecret && requestSecret && requestSecret === cronSecret);
}

async function getActiveDeliveryUrl(supabase: SupabaseClient, fallbackUrl: string | undefined) {
  const { data, error } = await supabase
    .from("second_life_delivery_servers")
    .select("id,server_url,last_seen_at,object_name,region_name")
    .eq("active", true)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data?.server_url) {
    return {
      id: data.id as string,
      url: data.server_url as string,
      label: `${data.object_name ?? "Second Life delivery server"}${data.region_name ? ` @ ${data.region_name}` : ""}`,
      lastSeenAt: data.last_seen_at as string | null,
    };
  }

  return fallbackUrl
    ? {
        id: "env-fallback",
        url: fallbackUrl,
        label: "SECOND_LIFE_DELIVERY_URL fallback",
        lastSeenAt: null,
      }
    : null;
}

async function markDeliveryUrlInactive(supabase: SupabaseClient, deliveryId: string) {
  if (!deliveryId || deliveryId === "env-fallback") {
    return;
  }

  await supabase.from("second_life_delivery_servers").update({ active: false }).eq("id", deliveryId);
}

function isExpiredSecondLifeCap(responseText: string, statusText: string) {
  return /cap not found|not found/i.test(`${responseText} ${statusText}`);
}

async function requireStaff(supabase: SupabaseClient, authHeader: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

  if (userError || !user) {
    return { allowed: false, status: 401, message: "You must be logged in to send Second Life notifications." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !["admin", "super_admin"].includes(profile.role)) {
    return { allowed: false, status: 403, message: "Only Love Potion staff can send Second Life notifications." };
  }

  return { allowed: true, userId: user.id };
}

async function resolveRecipient(
  supabase: SupabaseClient,
  recipientId: string | undefined,
  recipientSlUuid: string | undefined,
) {
  if (recipientSlUuid) {
    return { recipientId: recipientId ?? null, recipientSlUuid };
  }

  if (!recipientId) {
    return { error: "Missing recipient." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,sl_avatar_uuid")
    .eq("id", recipientId)
    .single();

  if (error || !profile) {
    return { error: "Recipient profile not found." };
  }

  if (!profile.sl_avatar_uuid) {
    return { error: "Recipient has no Second Life avatar UUID." };
  }

  return { recipientId: profile.id as string, recipientSlUuid: profile.sl_avatar_uuid as string };
}

async function processQueueItem(
  supabase: SupabaseClient,
  queueItem: QueueItem,
  fallbackDeliveryUrl: string | undefined,
  deliverySecret: string,
) {
  const queueId = clean(queueItem.id);
  const queueStatus = clean(queueItem.status);
  const recipientSlUuid = clean(queueItem.recipient_sl_uuid);
  const title = clean(queueItem.title);
  const metadata = queueItem.metadata;
  const actionUrl = clean(queueItem.action_url);
  const candidateImageUrl = metadataText(metadata, "image_url") || actionUrl;
  const imageUrl = (await canReachUrl(candidateImageUrl)) ? candidateImageUrl : "";
  const fallbackUrl = metadataText(metadata, "fallback_url") || imageUrl || actionUrl;
  const textureItemName = metadataText(metadata, "texture_item_name");
  const body = textureItemName ? clean(queueItem.body) : appendFallbackLink(clean(queueItem.body), fallbackUrl);
  const attempts = Number(queueItem.attempts ?? 0) + 1;
  const registeredDelivery = clean(queueItem.delivery_server_url)
    ? {
        id: "queue-override",
        url: clean(queueItem.delivery_server_url),
        label: "queue delivery URL",
        lastSeenAt: null,
      }
    : await getActiveDeliveryUrl(supabase, fallbackDeliveryUrl);

  if (queueStatus === "sent") {
    return { sent: true, status: 200, message: "Second Life notification was already sent.", notificationId: queueId };
  }

  if (queueStatus === "cancelled") {
    return { sent: false, status: 400, message: "Notification was cancelled and will not be sent.", notificationId: queueId };
  }

  if (!recipientSlUuid) {
    return { sent: false, status: 400, message: "Notification has no Second Life avatar UUID.", notificationId: queueId };
  }

  if (!registeredDelivery?.url) {
    return { sent: false, status: 500, message: "Second Life delivery URL is not configured.", notificationId: queueId };
  }

  try {
    const slResponse = await fetch(registeredDelivery.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "notify",
        secret: deliverySecret,
        notification_id: queueId,
        notification_type: queueItem.type,
        avatar_uuid: recipientSlUuid,
        title,
        body,
        action_url: actionUrl,
        image_url: imageUrl,
        fallback_url: fallbackUrl,
        texture_item_name: textureItemName,
      }),
    });

    const responseText = await slResponse.text();
    const sent = slResponse.ok;
    const errorText = responseText || slResponse.statusText;
    const expiredCap = !sent && isExpiredSecondLifeCap(responseText, slResponse.statusText);

    await supabase
      .from("notification_queue")
      .update({
        status: sent ? "sent" : "failed",
        attempts,
        sent_at: sent ? new Date().toISOString() : null,
        last_error: sent
          ? null
          : `${expiredCap ? "Second Life endpoint expired. Reset the delivery prim and confirm it registers again. " : ""}${errorText}`.slice(0, 2000),
      })
      .eq("id", queueId);

    if (!sent) {
      if (expiredCap) {
        await markDeliveryUrlInactive(supabase, registeredDelivery.id);
      }

      return {
        sent: false,
        status: 502,
        message: expiredCap
          ? `Second Life endpoint expired (${registeredDelivery.label}). Reset the delivery prim and wait for "Delivery URL registered with Love Potion HQ."`
          : `Second Life notification failed: ${errorText}`,
        notificationId: queueId,
      };
    }

    return { sent: true, status: 200, message: "Second Life notification sent.", notificationId: queueId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Second Life notification error.";

    await supabase
      .from("notification_queue")
      .update({
        status: "failed",
        attempts,
        last_error: message.slice(0, 2000),
      })
      .eq("id", queueId);

    return { sent: false, status: 502, message: `Second Life notification failed: ${message}`, notificationId: queueId };
  }
}

async function createQueueItem(supabase: SupabaseClient, payload: NotificationRequest) {
  const title = clean(payload.title);
  const body = clean(payload.body);
  const actionUrl = clean(payload.actionUrl);
  const imageUrl = clean(payload.imageUrl);
  const fallbackUrl = clean(payload.fallbackUrl) || imageUrl || actionUrl;
  const textureItemName = clean(payload.textureItemName);
  const recipient = await resolveRecipient(
    supabase,
    clean(payload.recipientId) || undefined,
    clean(payload.recipientSlUuid) || undefined,
  );

  if ("error" in recipient) {
    return { error: recipient.error, status: 400 };
  }

  if (!title && !body) {
    return { error: "Notification title or body is required.", status: 400 };
  }

  const { data, error } = await supabase
    .from("notification_queue")
    .insert({
      recipient_id: recipient.recipientId,
      recipient_sl_uuid: recipient.recipientSlUuid,
      channel: "second_life",
      type: clean(payload.type) || "manual",
      title,
      body: textureItemName ? body || null : appendFallbackLink(body, fallbackUrl) || null,
      action_url: actionUrl || null,
      metadata: {
        ...(payload.metadata ?? {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
        ...(fallbackUrl ? { fallback_url: fallbackUrl } : {}),
        ...(textureItemName ? { texture_item_name: textureItemName } : {}),
      },
      status: "pending",
    })
    .select("id,recipient_id,recipient_sl_uuid,delivery_server_url,type,title,body,action_url,metadata,status,attempts")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create notification queue item.", status: 500 };
  }

  return { data };
}

async function getQueueItem(supabase: SupabaseClient, queueId: string) {
  const { data, error } = await supabase
    .from("notification_queue")
    .select("id,recipient_id,recipient_sl_uuid,delivery_server_url,type,title,body,action_url,metadata,status,attempts")
    .eq("id", queueId)
    .single();

  if (error || !data) {
    return { error: "Notification queue item not found.", status: 404 };
  }

  return { data };
}

async function processDueQueue(supabase: SupabaseClient, fallbackDeliveryUrl: string | undefined, deliverySecret: string) {
  const { data, error } = await supabase
    .from("notification_queue")
    .select("id,recipient_id,recipient_sl_uuid,delivery_server_url,type,title,body,action_url,metadata,status,attempts")
    .eq("channel", "second_life")
    .in("status", ["pending", "failed"])
    .lte("scheduled_at", new Date().toISOString())
    .lt("attempts", 3)
    .order("scheduled_at", { ascending: true })
    .limit(25);

  if (error) {
    return { processed: 0, sent: 0, failed: 0, error: error.message };
  }

  let sent = 0;
  let failed = 0;

  for (const item of data ?? []) {
    const result = await processQueueItem(supabase, item, fallbackDeliveryUrl, deliverySecret);

    if (result.sent) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return { processed: data?.length ?? 0, sent, failed };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ sent: false, message: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const fallbackDeliveryUrl = Deno.env.get("SECOND_LIFE_DELIVERY_URL");
  const deliverySecret = Deno.env.get("SECOND_LIFE_DELIVERY_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !deliverySecret) {
    return json({ sent: false, message: "Second Life notification service is not configured." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const cronRequest = isCronRequest(request);

  let payload: NotificationRequest & { processDue?: boolean };
  try {
    payload = await request.json();
  } catch {
    return json({ sent: false, message: "Invalid notification request." }, 400);
  }

  if (payload.processDue) {
    if (!cronRequest) {
      const authHeader = request.headers.get("authorization") ?? "";
      const staff = await requireStaff(supabase, authHeader);

      if (!staff.allowed) {
        return json({ sent: false, message: staff.message }, staff.status ?? 403);
      }
    }

    const result = await processDueQueue(supabase, fallbackDeliveryUrl ?? undefined, deliverySecret);
    return json({ sent: true, message: "Pending Second Life notifications processed.", ...result });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const staff = await requireStaff(supabase, authHeader);

  if (!staff.allowed) {
    return json({ sent: false, message: staff.message }, staff.status ?? 403);
  }

  const queueResult = payload.queueId
    ? await getQueueItem(supabase, payload.queueId)
    : await createQueueItem(supabase, payload);

  if ("error" in queueResult) {
    return json({ sent: false, message: queueResult.error }, queueResult.status);
  }

  if (!queueResult.data) {
    return json({ sent: false, message: "Notification queue item could not be prepared." }, 500);
  }

  const result = await processQueueItem(supabase, queueResult.data, fallbackDeliveryUrl ?? undefined, deliverySecret);
  return json(result, result.status);
});

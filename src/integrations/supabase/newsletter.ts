import {
  logAuditEvent,
  processSecondLifeNotificationById,
} from "@/integrations/supabase/audit-log";
import { getCurrentProfile } from "@/integrations/supabase/auth";
import { supabase } from "@/integrations/supabase/client";
import type { NewsletterCampaign, NewsletterSubscriber } from "@/integrations/supabase/database.types";

type NewsletterCampaignInput = {
  title: string;
  body: string;
  imageFile?: File | null;
  slTextureItemName?: string;
};

export type NewsletterDeliveryStats = {
  total: number;
  sent: number;
  pending: number;
  failed: number;
  lastError: string | null;
};

export type NewsletterCampaignWithStats = NewsletterCampaign & {
  deliveryStats: NewsletterDeliveryStats;
};

type NewsletterQueueRow = {
  id: string;
  status: string | null;
};

type CsvSubscriberRow = {
  email: string | null;
  display_name: string | null;
  sl_avatar_name: string | null;
  sl_avatar_uuid: string;
  language_preference: "en" | "es";
  source: string;
  is_active: boolean;
  unsubscribed_at: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listNewsletterSubscribers() {
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select(
      "id,email,display_name,sl_avatar_name,sl_avatar_uuid,language_preference,source,is_active,notes,subscribed_at,unsubscribed_at,created_at,updated_at",
    )
    .order("subscribed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as NewsletterSubscriber[];
}

export async function listNewsletterCampaigns(limit = 8) {
  const { data, error } = await supabase
    .from("newsletter_campaigns")
    .select("id,created_by,title,body,image_url,status,recipient_count,queued_count,sent_at,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as NewsletterCampaign[];
}

export async function listNewsletterCampaignsWithStats(limit = 12): Promise<NewsletterCampaignWithStats[]> {
  const campaigns = await listNewsletterCampaigns(limit);
  return Promise.all(
    campaigns.map(async (campaign) => ({
      ...campaign,
      deliveryStats: await getNewsletterDeliveryStats(campaign.id),
    })),
  );
}

export async function uploadNewsletterImage(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  const filename = `${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${extension}`;
  const path = `campaigns/${filename}`;

  const { error } = await supabase.storage.from("newsletter-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("newsletter-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function importNewsletterSubscribersFromCsv(file: File) {
  const text = await file.text();
  const subscribers = parseNewsletterCsv(text);

  if (subscribers.length === 0) {
    throw new Error("No SL avatar UUIDs were found in this CSV.");
  }

  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .upsert(subscribers, { onConflict: "sl_avatar_uuid" })
    .select("id");

  if (error) throw error;

  await logAuditEvent({
    action: "newsletter_subscribers_imported",
    targetType: "newsletter",
    targetName: file.name,
    metadata: { count: subscribers.length },
  });

  return data?.length ?? subscribers.length;
}

export async function sendNewsletterCampaign(input: NewsletterCampaignInput) {
  const profile = await getCurrentProfile();
  if (!profile?.id) throw new Error("Staff profile not found.");

  let imageUrl: string | null = null;
  try {
    imageUrl = input.imageFile ? await uploadNewsletterImage(input.imageFile) : null;
  } catch (error) {
    throw new Error(`Could not upload newsletter image: ${describeNewsletterError(error)}`);
  }

  const { data: campaign, error: insertError } = await supabase
    .from("newsletter_campaigns")
    .insert({
      created_by: profile.id,
      title: input.title.trim(),
      body: input.body.trim(),
      image_url: imageUrl,
      status: "draft",
    })
    .select("id,created_by,title,body,image_url,status,recipient_count,queued_count,sent_at,created_at,updated_at")
    .single<NewsletterCampaign>();

  if (insertError) {
    throw new Error(`Could not create newsletter campaign: ${insertError.message}`);
  }

  const { data: queued, error: queueError } = await supabase.rpc("queue_newsletter_campaign", {
    target_campaign_id: campaign.id,
  });

  if (queueError) {
    throw new Error(`Could not queue newsletter campaign: ${queueError.message}`);
  }

  const textureItemName = input.slTextureItemName?.trim() || "";
  if (textureItemName) {
    await attachTextureToNewsletterQueue(campaign.id, textureItemName);
  }

  let processed = 0;
  let processWarning: string | null = null;
  try {
    const queueRows = await listNewsletterQueueRows(campaign.id);
    const pendingRows = queueRows.filter((row) => row.status !== "sent" && row.status !== "cancelled");

    for (const row of pendingRows) {
      try {
        await processSecondLifeNotificationById(row.id);
        processed += 1;
      } catch (error) {
        processWarning = describeNewsletterError(error);
        console.warn("[Newsletter] Could not process newsletter queue item.", { queueId: row.id, error });
      }
    }
  } catch (error) {
    processWarning = describeNewsletterError(error);
    console.warn("[Newsletter] Campaign queued, but immediate SL processing failed.", error);
  }

  const deliveryStats = await getNewsletterDeliveryStats(campaign.id);

  try {
    await logAuditEvent({
      action: "newsletter_campaign_sent",
      targetType: "newsletter_campaign",
      targetId: campaign.id,
      targetName: campaign.title,
      metadata: { queued, processed, imageUrl, processWarning, deliveryStats },
    });
  } catch (error) {
    console.warn("[Newsletter] Campaign sent, but audit logging failed.", error);
  }

  return {
    campaign: {
      ...campaign,
      status: "queued" as const,
      recipient_count: typeof queued === "number" ? queued : 0,
      queued_count: typeof queued === "number" ? queued : 0,
      sent_at: new Date().toISOString(),
    },
    queued: typeof queued === "number" ? queued : 0,
    processed,
    processWarning,
    deliveryStats,
  };
}

async function listNewsletterQueueRows(campaignId: string): Promise<NewsletterQueueRow[]> {
  const { data, error } = await supabase
    .from("notification_queue")
    .select("id,status")
    .eq("channel", "second_life")
    .contains("metadata", { source: "newsletter", campaign_id: campaignId })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not read newsletter delivery queue: ${error.message}`);
  }

  return (data ?? []) as NewsletterQueueRow[];
}

async function attachTextureToNewsletterQueue(campaignId: string, textureItemName: string) {
  const { data, error } = await supabase
    .from("notification_queue")
    .select("id,metadata")
    .eq("channel", "second_life")
    .contains("metadata", { source: "newsletter", campaign_id: campaignId });

  if (error) {
    throw new Error(`Could not prepare newsletter texture delivery: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ id: string; metadata: Record<string, unknown> | null }>;
  await Promise.all(
    rows.map((row) =>
      supabase
        .from("notification_queue")
        .update({
          metadata: {
            ...(row.metadata ?? {}),
            texture_item_name: textureItemName,
          },
        })
        .eq("id", row.id)
        .then(({ error: updateError }) => {
          if (updateError) {
            throw new Error(`Could not attach texture to newsletter queue: ${updateError.message}`);
          }
        }),
    ),
  );
}

async function getNewsletterDeliveryStats(campaignId: string): Promise<NewsletterDeliveryStats> {
  const { data, error } = await supabase
    .from("notification_queue")
    .select("status,last_error")
    .eq("channel", "second_life")
    .contains("metadata", { source: "newsletter", campaign_id: campaignId });

  if (error) {
    console.warn("[Newsletter] Could not read delivery stats.", error);
    return {
      total: 0,
      sent: 0,
      pending: 0,
      failed: 0,
      lastError: error.message,
    };
  }

  const rows = (data ?? []) as Array<{ status: string | null; last_error?: string | null }>;
  return rows.reduce<NewsletterDeliveryStats>(
    (stats, row) => {
      stats.total += 1;
      if (row.status === "sent") stats.sent += 1;
      else if (row.status === "failed") {
        stats.failed += 1;
        stats.lastError = row.last_error ?? stats.lastError;
      } else stats.pending += 1;
      return stats;
    },
    { total: 0, sent: 0, pending: 0, failed: 0, lastError: null },
  );
}

export async function setNewsletterSubscriberActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from("newsletter_subscribers")
    .update({
      is_active: isActive,
      unsubscribed_at: isActive ? null : new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;

  await logAuditEvent({
    action: isActive ? "newsletter_subscriber_reactivated" : "newsletter_subscriber_paused",
    targetType: "newsletter_subscriber",
    targetId: id,
  });
}

function parseNewsletterCsv(text: string) {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length === 0) return [];

  const header = rows[0].map((cell) => normalizeHeader(cell));
  const hasHeader = header.some((cell) =>
    ["uuid", "sl_avatar_uuid", "avatar_uuid", "key", "email", "name", "display_name", "sl_avatar_name"].includes(cell),
  );
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const result = new Map<string, CsvSubscriberRow>();

  for (const row of dataRows) {
    const parsed = hasHeader ? parseRowWithHeader(row, header) : parseRowWithoutHeader(row);
    if (!parsed?.sl_avatar_uuid) continue;
    result.set(parsed.sl_avatar_uuid, parsed);
  }

  return Array.from(result.values());
}

function parseRowWithHeader(row: string[], header: string[]): CsvSubscriberRow | null {
  const get = (...keys: string[]) => {
    const index = header.findIndex((name) => keys.includes(name));
    return index >= 0 ? row[index]?.trim() || "" : "";
  };

  const uuid = get("uuid", "sl_avatar_uuid", "avatar_uuid", "key");
  if (!UUID_RE.test(uuid)) return null;

  const language = get("language", "lang", "language_preference").toLowerCase();
  const name = get("name", "display_name", "sl_avatar_name", "avatar_name");

  return {
    email: get("email") || null,
    display_name: name || null,
    sl_avatar_name: name || null,
    sl_avatar_uuid: uuid,
    language_preference: language === "es" ? "es" : "en",
    source: "csv_import",
    is_active: true,
    unsubscribed_at: null,
  };
}

function parseRowWithoutHeader(row: string[]): CsvSubscriberRow | null {
  const cells = row.map((cell) => cell.trim()).filter(Boolean);
  const uuid = cells.find((cell) => UUID_RE.test(cell));
  if (!uuid) return null;

  const email = cells.find((cell) => cell.includes("@")) ?? null;
  const name = cells.find((cell) => cell !== uuid && cell !== email && !["en", "es"].includes(cell.toLowerCase())) ?? null;
  const language = cells.find((cell) => ["en", "es"].includes(cell.toLowerCase()))?.toLowerCase();

  return {
    email,
    display_name: name,
    sl_avatar_name: name,
    sl_avatar_uuid: uuid,
    language_preference: language === "es" ? "es" : "en",
    source: "csv_import",
    is_active: true,
    unsubscribed_at: null,
  };
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "newsletter"
  );
}

function describeNewsletterError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error.";
}

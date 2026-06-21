import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ToggleRequest = {
  secret?: string;
  avatar_uuid?: string;
  avatar_name?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ ok: false, message: "Method not allowed." }, 405);
    }

    const payload = (await req.json()) as ToggleRequest;
    const configuredSecret = Deno.env.get("SECOND_LIFE_DELIVERY_SECRET");

    if (!configuredSecret || payload.secret !== configuredSecret) {
      return json({ ok: false, message: "Invalid newsletter secret." }, 403);
    }

    const avatarUuid = payload.avatar_uuid?.trim();
    if (!avatarUuid) {
      return json({ ok: false, message: "Missing avatar UUID." }, 400);
    }

    const avatarName = payload.avatar_name?.trim() || "Second Life Resident";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, message: "Supabase service is not configured." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: existing, error: lookupError } = await supabase
      .from("newsletter_subscribers")
      .select("id,is_active,unsubscribed_at")
      .eq("sl_avatar_uuid", avatarUuid)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing?.id && existing.is_active && !existing.unsubscribed_at) {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .update({
          is_active: false,
          unsubscribed_at: new Date().toISOString(),
          display_name: avatarName,
          sl_avatar_name: avatarName,
        })
        .eq("id", existing.id);

      if (error) throw error;

      return json({
        ok: true,
        subscribed: false,
        message: "You have been removed from Love Potion news.",
      });
    }

    const { error } = await supabase.from("newsletter_subscribers").upsert(
      {
        sl_avatar_uuid: avatarUuid,
        sl_avatar_name: avatarName,
        display_name: avatarName,
        language_preference: "en",
        source: "second_life_prim",
        is_active: true,
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null,
      },
      { onConflict: "sl_avatar_uuid" },
    );

    if (error) throw error;

    return json({
      ok: true,
      subscribed: true,
      message: "You are now subscribed to Love Potion news.",
    });
  } catch (error) {
    console.error("[toggle-newsletter-subscriber]", error);
    return json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Newsletter subscription failed.",
      },
      500,
    );
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

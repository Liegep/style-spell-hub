import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AdminDeliveryRequest = {
  claimId?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

async function getActiveDeliveryUrl(
  supabase: ReturnType<typeof createClient>,
  fallbackUrl: string | undefined,
) {
  const { data, error } = await supabase
    .from("second_life_delivery_servers")
    .select("server_url")
    .eq("active", true)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data?.server_url) {
    return data.server_url as string;
  }

  return fallbackUrl;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ delivered: false, message: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const fallbackDeliveryUrl = Deno.env.get("SECOND_LIFE_DELIVERY_URL");
  const deliverySecret = Deno.env.get("SECOND_LIFE_DELIVERY_SECRET");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ delivered: false, message: "Supabase service credentials are missing." }, 500);
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

  if (userError || !user) {
    return json({ delivered: false, message: "You must be logged in to retry deliveries." }, 401);
  }

  const { data: requester, error: requesterError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .single();

  if (requesterError || !requester || requester.role !== "super_admin") {
    return json({ delivered: false, message: "Only the Love Potion owner can retry deliveries." }, 403);
  }

  let payload: AdminDeliveryRequest;
  try {
    payload = await request.json();
  } catch {
    return json({ delivered: false, message: "Invalid delivery request." }, 400);
  }

  if (!payload.claimId) {
    return json({ delivered: false, message: "Missing claim id." }, 400);
  }

  const deliveryUrl = await getActiveDeliveryUrl(supabase, fallbackDeliveryUrl ?? undefined);
  if (!deliveryUrl) {
    return json({ delivered: false, message: "Second Life delivery URL is not configured." }, 500);
  }

  const { data: claim, error: claimError } = await supabase
    .from("product_claims")
    .select("id,product_id,blogger_id,status")
    .eq("id", payload.claimId)
    .single();

  if (claimError || !claim) {
    return json({ delivered: false, message: "Claim not found." }, 404);
  }

  const [{ data: profile, error: profileError }, { data: product, error: productError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,display_name,sl_avatar_name,sl_avatar_uuid,account_status")
      .eq("id", claim.blogger_id)
      .single(),
    supabase
      .from("product_releases")
      .select("id,name,delivery_item_key,status")
      .eq("id", claim.product_id)
      .single(),
  ]);

  if (profileError || !profile) {
    return json({ delivered: false, message: "Blogger profile not found." }, 404);
  }

  if (productError || !product) {
    return json({ delivered: false, message: "Product not found." }, 404);
  }

  if (profile.account_status !== "active") {
    return json({ delivered: false, message: "This blogger account is not active." }, 403);
  }

  if (!profile.sl_avatar_uuid) {
    return json({ delivered: false, message: "This blogger has no Second Life avatar UUID." }, 400);
  }

  if (product.status !== "available") {
    return json({ delivered: false, message: "This product is not available for delivery." }, 400);
  }

  if (!product.delivery_item_key) {
    return json({ delivered: false, message: "This product has no Second Life delivery item key." }, 400);
  }

  const slPayload = {
    secret: deliverySecret ?? null,
    claim_id: claim.id,
    product_id: product.id,
    product_name: product.name,
    item_key: product.delivery_item_key,
    avatar_uuid: profile.sl_avatar_uuid,
    avatar_name: profile.sl_avatar_name,
    display_name: profile.display_name,
  };

  try {
    const slResponse = await fetch(deliveryUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(slPayload),
    });

    const responseText = await slResponse.text();
    const delivered = slResponse.ok;

    const { data: updatedClaim, error: updateError } = await supabase
      .from("product_claims")
      .update({
        status: delivered ? "delivered" : "failed",
        delivered_at: delivered ? new Date().toISOString() : null,
        delivery_response: responseText.slice(0, 2000),
      })
      .eq("id", claim.id)
      .select("id,status,delivery_response,delivered_at")
      .single();

    if (updateError) {
      return json(
        {
          delivered: false,
          message: `Second Life answered, but the claim status could not be saved: ${updateError.message}`,
        },
        500,
      );
    }

    if (!delivered) {
      return json(
        {
          delivered: false,
          message: `Second Life delivery failed: ${responseText || slResponse.statusText}`,
          claim: updatedClaim,
        },
        502,
      );
    }

    return json({
      delivered: true,
      message: `Delivered ${product.name} to ${profile.sl_avatar_name ?? profile.display_name ?? "the blogger"}.`,
      claim: updatedClaim,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Second Life delivery error.";

    const { data: updatedClaim, error: updateError } = await supabase
      .from("product_claims")
      .update({
        status: "failed",
        delivery_response: message.slice(0, 2000),
      })
      .eq("id", claim.id)
      .select("id,status,delivery_response,delivered_at")
      .single();

    if (updateError) {
      return json(
        {
          delivered: false,
          message: `Second Life delivery failed, and the failed status could not be saved: ${updateError.message}`,
        },
        500,
      );
    }

    return json({
      delivered: false,
      message: `Second Life delivery failed: ${message}`,
      claim: updatedClaim,
    }, 502);
  }
});

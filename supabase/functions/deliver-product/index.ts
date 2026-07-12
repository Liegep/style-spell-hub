import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DeliveryRequest = {
  productId?: string;
  product_id?: string;
  claimId?: string;
  claim_id?: string;
  demo?: boolean;
  mode?: string;
  type?: string;
};

type DeliveryPurpose = "product" | "demo";

function isDemoDropboxName(objectName: string | null | undefined) {
  return typeof objectName === "string" && /demo/i.test(objectName);
}

async function getActiveDeliveryUrl(
  supabase: ReturnType<typeof createClient>,
  fallbackUrl: string | undefined,
  purpose: DeliveryPurpose = "product",
) {
  const { data, error } = await supabase
    .from("second_life_delivery_servers")
    .select("server_url,object_name")
    .eq("active", true)
    .order("last_seen_at", { ascending: false })
    .limit(20);

  if (!error && data?.length) {
    const matchingRow =
      purpose === "demo"
        ? data.find((row) => isDemoDropboxName(row.object_name))
        : data.find((row) => !isDemoDropboxName(row.object_name));

    if (matchingRow?.server_url) {
      return matchingRow.server_url as string;
    }

    const fallbackRow =
      purpose === "demo"
        ? data.find((row) => Boolean(row.server_url))
        : data.find((row) => Boolean(row.server_url) && !isDemoDropboxName(row.object_name));

    if (fallbackRow?.server_url) {
      return fallbackRow.server_url as string;
    }
  }

  return fallbackUrl;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
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
    return json({ delivered: false, message: "You must be logged in to claim products." }, 401);
  }

  let payload: DeliveryRequest;
  try {
    payload = await request.json();
  } catch {
    return json({ delivered: false, message: "Invalid delivery request." }, 400);
  }

  const productId = payload.productId ?? payload.product_id;
  const claimId = payload.claimId ?? payload.claim_id;
  const demoRequest = payload.demo === true || payload.mode === "demo" || payload.type === "demo";

  if (!productId) {
    return json({ delivered: false, message: "Missing product id." }, 400);
  }

  if (!demoRequest && !claimId) {
    return json({ delivered: false, message: "Missing claim id." }, 400);
  }

  const deliveryUrl = await getActiveDeliveryUrl(
    supabase,
    fallbackDeliveryUrl ?? undefined,
    demoRequest ? "demo" : "product",
  );

  if (!deliveryUrl) {
    return json({ delivered: false, message: "Second Life delivery URL is not configured." }, 500);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,display_name,sl_avatar_name,sl_avatar_uuid,account_status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return json({ delivered: false, message: "Profile not found." }, 404);
  }

  if (profile.account_status !== "active") {
    return json({ delivered: false, message: "Your account is not active." }, 403);
  }

  if (!profile.sl_avatar_uuid) {
    return json({ delivered: false, message: "Second Life avatar UUID is missing from your profile." }, 400);
  }

  const { data: product, error: productError } = await supabase
    .from("product_releases")
    .select("id,name,delivery_item_key,demo_item_key,status")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    return json({ delivered: false, message: "Product not found." }, 404);
  }

  if (product.status !== "available") {
    return json({ delivered: false, message: "This product is not available for delivery." }, 400);
  }

  const itemKey = demoRequest ? product.demo_item_key : product.delivery_item_key;

  if (!itemKey) {
    return json(
      {
        delivered: false,
        message: demoRequest
          ? "This product has no Second Life demo item key."
          : "This product has no Second Life delivery item key.",
      },
      400,
    );
  }

  if (demoRequest) {
    const slPayload = {
      secret: deliverySecret ?? null,
      claim_id: null,
      product_id: product.id,
      product_name: product.name,
      item_key: itemKey,
      avatar_uuid: profile.sl_avatar_uuid,
      avatar_name: profile.sl_avatar_name,
      display_name: profile.display_name,
      demo: true,
    };

    try {
      const slResponse = await fetch(deliveryUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(slPayload),
      });

      const responseText = await slResponse.text();

      if (!slResponse.ok) {
        return json(
          {
            delivered: false,
            message: `Second Life demo delivery failed: ${responseText || slResponse.statusText}`,
          },
          502,
        );
      }

      const bloggerName = profile.display_name ?? profile.sl_avatar_name ?? "A blogger";

      const { error: auditError } = await supabase.from("audit_logs").insert({
        actor_id: profile.id,
        actor_name: bloggerName,
        actor_role: "blogger",
        action: "Demo picked up",
        target_type: "product",
        target_id: product.id,
        target_name: product.name,
        metadata: {
          demo: true,
          product_id: product.id,
          product_name: product.name,
          blogger_id: profile.id,
          blogger_name: bloggerName,
          delivery_item_name: itemKey,
        },
      });

      if (auditError) {
        console.warn("Could not log demo pickup audit event.", auditError);
      }

      return json({
        delivered: true,
        message: `Demo delivered to ${profile.sl_avatar_name ?? profile.display_name ?? "your avatar"}. This does not count as a claim.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Second Life delivery error.";
      return json({ delivered: false, message: `Second Life demo delivery failed: ${message}` }, 502);
    }
  }

  const { data: claim, error: claimError } = await supabase
    .from("product_claims")
    .select("id,product_id,blogger_id,status")
    .eq("id", claimId!)
    .eq("product_id", productId)
    .eq("blogger_id", user.id)
    .single();

  if (claimError || !claim) {
    return json({ delivered: false, message: "Claim not found." }, 404);
  }

  const slPayload = {
    secret: deliverySecret ?? null,
    claim_id: claim.id,
    product_id: product.id,
    product_name: product.name,
    item_key: itemKey,
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

    const { error: updateError } = await supabase
      .from("product_claims")
      .update({
        status: delivered ? "delivered" : "failed",
        delivered_at: delivered ? new Date().toISOString() : null,
        delivery_response: responseText.slice(0, 2000),
      })
      .eq("id", claim.id);

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
        },
        502,
      );
    }

    return json({
      delivered: true,
      message: `Delivered ${product.name} to ${profile.sl_avatar_name ?? profile.display_name ?? "your avatar"}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Second Life delivery error.";

    const { error: updateError } = await supabase
      .from("product_claims")
      .update({
        status: "failed",
        delivery_response: message.slice(0, 2000),
      })
      .eq("id", claim.id);

    if (updateError) {
      return json(
        {
          delivered: false,
          message: `Second Life delivery failed, and the failed status could not be saved: ${updateError.message}`,
        },
        500,
      );
    }

    return json({ delivered: false, message: `Second Life delivery failed: ${message}` }, 502);
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RegisterRequest = {
  secret?: string | null;
  server_url?: string | null;
  object_name?: string | null;
  object_key?: string | null;
  region_name?: string | null;
  owner_key?: string | null;
};

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
    return json({ registered: false, message: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const deliverySecret = Deno.env.get("SECOND_LIFE_DELIVERY_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !deliverySecret) {
    return json({ registered: false, message: "Delivery registration is not configured." }, 500);
  }

  let payload: RegisterRequest;
  try {
    payload = await request.json();
  } catch {
    return json({ registered: false, message: "Invalid registration request." }, 400);
  }

  if (payload.secret !== deliverySecret) {
    return json({ registered: false, message: "Invalid delivery secret." }, 403);
  }

  const serverUrl = payload.server_url?.trim();
  if (!serverUrl || !serverUrl.startsWith("http")) {
    return json({ registered: false, message: "Missing Second Life server URL." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.from("second_life_delivery_servers").upsert(
    {
      id: "primary",
      server_url: serverUrl,
      object_name: payload.object_name?.trim() || null,
      object_key: payload.object_key?.trim() || null,
      region_name: payload.region_name?.trim() || null,
      owner_key: payload.owner_key?.trim() || null,
      active: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    return json({ registered: false, message: error.message }, 500);
  }

  return json({ registered: true, message: "Second Life delivery server registered." });
});

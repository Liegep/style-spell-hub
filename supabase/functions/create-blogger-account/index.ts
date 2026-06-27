import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CreateBloggerRequest = {
  email?: string;
  password?: string;
  displayName?: string;
  avatarName?: string;
  avatarUuid?: string | null;
  language?: "en" | "es";
  accountStatus?: "pending" | "active";
  bloggerTier?: "standard" | "honor_guest";
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, message: "Supabase service credentials are missing." }, 500);
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

  if (userError || !user) {
    return json({ ok: false, message: "You must be logged in to create blogger accounts." }, 401);
  }

  const { data: requester, error: requesterError } = await supabase
    .from("profiles")
    .select("id,display_name,full_name,email,role")
    .eq("id", user.id)
    .single();

  if (requesterError || !requester || !["admin", "super_admin"].includes(requester.role as string)) {
    return json({ ok: false, message: "Only Love Potion staff can create blogger accounts." }, 403);
  }

  let payload: CreateBloggerRequest;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Invalid blogger account request." }, 400);
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password ?? "";
  const displayName = payload.displayName?.trim();
  const avatarName = payload.avatarName?.trim() || displayName;
  const avatarUuid = payload.avatarUuid?.trim() || null;
  const language = payload.language === "es" ? "es" : "en";
  const accountStatus = payload.accountStatus === "pending" ? "pending" : "active";
  const bloggerTier = payload.bloggerTier === "honor_guest" ? "honor_guest" : "standard";

  if (!email || !email.includes("@")) {
    return json({ ok: false, message: "A valid email is required." }, 400);
  }

  if (!password || password.length < 6) {
    return json({ ok: false, message: "Temporary password must have at least 6 characters." }, 400);
  }

  if (!displayName) {
    return json({ ok: false, message: "Display name is required." }, 400);
  }

  if (avatarUuid && !UUID_RE.test(avatarUuid)) {
    return json({ ok: false, message: "SL avatar UUID format looks invalid." }, 400);
  }

  const { data: authData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      sl_avatar_name: avatarName,
      role: "blogger",
    },
  });

  if (createError || !authData.user?.id) {
    return json(
      {
        ok: false,
        message: createError?.message ?? "Could not create auth user.",
      },
      400,
    );
  }

  const userId = authData.user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      email,
      display_name: displayName,
      full_name: displayName,
      sl_avatar_name: avatarName,
      sl_legacy_name: avatarName,
      sl_display_name: avatarName,
      sl_avatar_uuid: avatarUuid,
      role: "blogger",
      account_status: accountStatus,
      blogger_tier: bloggerTier,
      language_preference: language,
      availability_status: "available",
    })
    .select("id,email,display_name,full_name,sl_avatar_name,language_preference,account_status,availability_status,blogger_tier,created_at,sl_avatar_uuid")
    .single();

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    return json({ ok: false, message: profileError.message }, 400);
  }

  await supabase.from("audit_logs").insert({
    actor_id: requester.id,
    actor_name: requester.display_name ?? requester.full_name ?? requester.email ?? null,
    actor_role: requester.role,
    action: "Created blogger account",
    target_type: "profile",
    target_id: userId,
    target_name: displayName,
    metadata: {
      email,
      sl_avatar_name: avatarName,
      sl_avatar_uuid: avatarUuid,
      account_status: accountStatus,
      blogger_tier: bloggerTier,
      language,
    },
  });

  return json({ ok: true, userId, profile });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

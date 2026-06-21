import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/integrations/supabase/audit-log";
import { createStaffInAppNotification } from "@/integrations/supabase/notifications";
import type { AppRole, Profile } from "@/integrations/supabase/database.types";

export type AuthProfile = Pick<
  Profile,
  | "id"
  | "email"
  | "display_name"
  | "full_name"
  | "sl_avatar_name"
  | "sl_avatar_uuid"
  | "avatar_url"
  | "role"
  | "account_status"
  | "availability_status"
  | "status_message"
  | "language_preference"
  | "flickr_url"
  | "instagram_url"
  | "facebook_url"
  | "blog_url"
>;

export function getRoleHome(role: AppRole) {
  if (role === "blogger") return "/app/blogger";
  return "/app/atelier";
}

async function resolveEmailFromAvatarName(avatarName: string) {
  const name = avatarName.trim().replace(/\s+/g, " ");
  if (!name) return null;

  // Preferred path: SECURITY DEFINER RPC that can read profiles pre-login.
  // This avoids relying on anon SELECT access to profiles under RLS.
  const rpc = await supabase.rpc("get_email_by_avatar_name", { avatar_lookup: name });
  if (!rpc.error && typeof rpc.data === "string" && rpc.data.trim()) {
    return rpc.data.trim();
  }

  const candidates = [name];
  if (!/ resident$/i.test(name)) candidates.push(`${name} Resident`);
  if (/ resident$/i.test(name)) candidates.push(name.replace(/\s+resident$/i, ""));

  const { data, error } = await supabase
    .from("profiles")
    .select("email,sl_avatar_name,sl_legacy_name,sl_display_name,display_name")
    .or(
      candidates
        .map((candidate) => {
          const safe = candidate.replace(/,/g, "\\,").replace(/\./g, "\\.");
          return [
            `sl_avatar_name.ilike.${safe}`,
            `sl_legacy_name.ilike.${safe}`,
            `sl_display_name.ilike.${safe}`,
            `display_name.ilike.${safe}`,
          ].join(",");
        })
        .join(","),
    )
    .limit(20);

  if (error) throw error;
  const rows =
    (data as Array<
      Pick<Profile, "email" | "sl_avatar_name" | "sl_legacy_name" | "sl_display_name" | "display_name">
    > | null) ?? [];

  const normalizedCandidates = new Set(candidates.map((value) => value.toLowerCase()));
  const exact = rows.find((row) =>
    [row.sl_avatar_name, row.sl_legacy_name, row.sl_display_name, row.display_name]
      .filter(Boolean)
      .some((value) => normalizedCandidates.has((value as string).trim().toLowerCase())),
  );

  return exact?.email ?? rows[0]?.email ?? null;
}

export async function signInWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error("Login succeeded, but Supabase did not return a user.");

  const profile = await getCurrentProfile(data.user.id);
  return { user: data.user, profile };
}

export async function signInWithIdentifier(identifier: string, password: string) {
  const value = identifier.trim();
  if (!value) throw new Error("Please enter your avatar name or email.");

  const loginEmail = value.includes("@") ? value : await resolveEmailFromAvatarName(value);
  if (!loginEmail) {
    throw new Error("Avatar name not found. Check the spelling or ask admin to update your profile.");
  }

  return signInWithEmail(loginEmail, password);
}

export async function getCurrentProfile(userId?: string) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet.");
  }

  const id = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,email,display_name,full_name,sl_avatar_name,sl_avatar_uuid,avatar_url,role,account_status,availability_status,status_message,language_preference,flickr_url,instagram_url,facebook_url,blog_url",
    )
    .eq("id", id)
    .maybeSingle<AuthProfile>();

  if (error) throw describeProfileSaveError(error);
  return data;
}

export async function leaveBloggerProgram(reason?: string) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet.");
  }

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("No authenticated user.");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      account_status: "left",
      availability_status: "offline",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .eq("role", "blogger")
    .select(
      "id,email,display_name,full_name,sl_avatar_name,sl_avatar_uuid,avatar_url,role,account_status,availability_status,status_message,language_preference,flickr_url,instagram_url,facebook_url,blog_url",
    )
    .single<AuthProfile>();

  if (error) throw describeProfileSaveError(error);

  if (data.account_status !== "left") {
    throw new Error("The database blocked the leave action. Run the blogger self-leave SQL update, then try again.");
  }

  const displayName = data.display_name || data.full_name || data.email;
  const cleanReason = reason?.trim() || null;

  void logAuditEvent({
    action: "Blogger left platform",
    targetType: "profile",
    targetId: data.id,
    targetName: displayName,
    metadata: {
      sl_avatar_uuid: data.sl_avatar_uuid,
      sl_avatar_name: data.sl_avatar_name,
      reason: cleanReason,
    },
  });

  void createStaffInAppNotification({
    title: "Blogger left the platform",
    body: `${displayName} left the blogger program.${data.sl_avatar_uuid ? ` UUID: ${data.sl_avatar_uuid}.` : ""}${cleanReason ? ` Reason: ${cleanReason}` : ""}`,
    actionUrl: "/app/bloggers",
    metadata: {
      source: "blogger_leave",
      blogger_id: data.id,
      sl_avatar_uuid: data.sl_avatar_uuid,
      leave_reason: cleanReason,
    },
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bloggers-updated", { detail: data }));
  }

  return data;
}

function describeProfileSaveError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  ) {
    return new Error("This SL avatar UUID is already connected to another profile.");
  }

  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return new Error(message);
  }
  return new Error("Could not save profile.");
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      console.warn("[Auth] Supabase sign out returned an error; clearing local session anyway.", error);
    }
  } catch (error) {
    console.warn("[Auth] Supabase sign out failed; clearing local session anyway.", error);
  } finally {
    clearSupabaseAuthStorage();
  }
}

function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return;

  const shouldRemove = (key: string) =>
    key.startsWith("sb-") ||
    key.startsWith("lp-onboarding-") ||
    key.includes("supabase.auth.token") ||
    key.includes("supabase");

  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => Boolean(key),
    );

    for (const key of keys) {
      if (shouldRemove(key)) storage.removeItem(key);
    }
  }
}

export async function updateCurrentPassword(currentPassword: string, newPassword: string) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const email = userData.user?.email;
  if (!email) throw new Error("No authenticated email found.");

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) throw new Error("Current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw describeProfileSaveError(error);
}

export async function updateCurrentProfile(
  patch: Partial<
    Pick<
      Profile,
      | "display_name"
      | "full_name"
      | "avatar_url"
      | "sl_avatar_uuid"
      | "availability_status"
      | "status_message"
      | "language_preference"
      | "flickr_url"
      | "instagram_url"
      | "facebook_url"
      | "blog_url"
    >
  >,
) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured yet.");
  }

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("No authenticated user.");

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select(
      "id,email,display_name,full_name,sl_avatar_name,sl_avatar_uuid,avatar_url,role,account_status,availability_status,status_message,language_preference,flickr_url,instagram_url,facebook_url,blog_url",
    )
    .single<AuthProfile>();

  if (error) throw error;
  return data;
}

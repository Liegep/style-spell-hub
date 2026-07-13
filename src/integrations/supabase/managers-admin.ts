import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/integrations/supabase/audit-log";
import type { AccountStatus, AppRole, Profile } from "@/integrations/supabase/database.types";

export type ManagerRole = Extract<AppRole, "admin" | "super_admin">;

export type ManagerListItem = Pick<
  Profile,
  "id" | "email" | "display_name" | "full_name" | "role" | "account_status" | "created_at" | "updated_at"
>;

const MANAGER_SELECT = "id,email,display_name,full_name,role,account_status,created_at,updated_at";

export async function listManagers() {
  const { data, error } = await supabase
    .from("profiles")
    .select(MANAGER_SELECT)
    .in("role", ["admin", "super_admin"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ManagerListItem[];
}

export async function createManagerAccount(input: {
  email: string;
  password: string;
  displayName: string;
  role: ManagerRole;
  accountStatus: AccountStatus;
}) {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select(MANAGER_SELECT)
    .eq("email", email)
    .maybeSingle<ManagerListItem>();

  if (existingProfileError) throw existingProfileError;

  if (existingProfile) {
    if (existingProfile.role === "admin" || existingProfile.role === "super_admin") {
      throw new Error("This email already belongs to a manager account.");
    }

    const { data: promotedProfile, error: promotedProfileError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        full_name: displayName,
        role: input.role,
        account_status: input.accountStatus,
        availability_status: "available",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingProfile.id)
      .eq("role", "blogger")
      .select(MANAGER_SELECT)
      .single<ManagerListItem>();

    if (promotedProfileError) throw promotedProfileError;

    void logAuditEvent({
      action: "Promoted blogger to manager",
      targetType: "profile",
      targetId: promotedProfile.id,
      targetName: promotedProfile.display_name ?? promotedProfile.full_name ?? promotedProfile.email,
      metadata: {
        email,
        previous_role: "blogger",
        role: input.role,
        account_status: input.accountStatus,
      },
    });

    return promotedProfile;
  }

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) throw new Error("Supabase is not configured.");

  const signupClient = createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `lp-manager-onboarding-${Date.now()}`,
    },
  });

  const { data: signUpData, error: signUpError } = await signupClient.auth.signUp({
    email,
    password: input.password,
  });

  if (signUpError) throw signUpError;
  if (!signUpData.user?.id) throw new Error("Could not create auth user.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: signUpData.user.id,
      email,
      display_name: displayName,
      full_name: displayName,
      role: input.role,
      account_status: input.accountStatus,
      availability_status: "available",
      language_preference: "en",
    })
    .select(MANAGER_SELECT)
    .single<ManagerListItem>();

  if (profileError) throw profileError;

  void logAuditEvent({
    action: "Created manager account",
    targetType: "profile",
    targetId: profile.id,
    targetName: profile.display_name ?? profile.full_name ?? profile.email,
    metadata: {
      email,
      role: input.role,
      account_status: input.accountStatus,
    },
  });

  return profile;
}

export async function updateManagerDetails(input: {
  managerId: string;
  displayName: string;
  role: ManagerRole;
  accountStatus: AccountStatus;
}) {
  const displayName = input.displayName.trim();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      full_name: displayName,
      role: input.role,
      account_status: input.accountStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.managerId)
    .in("role", ["admin", "super_admin"])
    .select(MANAGER_SELECT)
    .single<ManagerListItem>();

  if (error) throw error;

  void logAuditEvent({
    action: "Updated manager account",
    targetType: "profile",
    targetId: data.id,
    targetName: data.display_name ?? data.full_name ?? data.email,
    metadata: {
      role: data.role,
      account_status: data.account_status,
    },
  });

  return data;
}

export async function removeManagerAccount(managerId: string) {
  const currentUserId = (await supabase.auth.getUser()).data.user?.id;
  if (!currentUserId) throw new Error("No authenticated user.");
  if (managerId === currentUserId) {
    throw new Error("You cannot remove your own manager access.");
  }

  const { data: manager, error: managerError } = await supabase
    .from("profiles")
    .select(MANAGER_SELECT)
    .eq("id", managerId)
    .in("role", ["admin", "super_admin"])
    .maybeSingle<ManagerListItem>();

  if (managerError) throw managerError;
  if (!manager) throw new Error("Manager not found.");

  if (manager.role === "super_admin") {
    const { count, error: countError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("account_status", "active")
      .neq("id", managerId);

    if (countError) throw countError;
    if ((count ?? 0) < 1) {
      throw new Error("Keep at least one active super admin before removing this account.");
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      account_status: "blocked",
      availability_status: "offline",
      updated_at: new Date().toISOString(),
    })
    .eq("id", managerId)
    .in("role", ["admin", "super_admin"])
    .select(MANAGER_SELECT)
    .single<ManagerListItem>();

  if (error) throw error;

  void logAuditEvent({
    action: "Removed manager access",
    targetType: "profile",
    targetId: data.id,
    targetName: data.display_name ?? data.full_name ?? data.email,
    metadata: {
      role: data.role,
      account_status: data.account_status,
      removal_source: "staff",
    },
  });

  return data;
}

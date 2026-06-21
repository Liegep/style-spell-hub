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

  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

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

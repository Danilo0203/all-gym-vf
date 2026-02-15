import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@/types";

const VALID_ROLES: UserRole[] = ["admin", "trainer", "employee", "client"];

export interface UserAccessContext {
  isAuthenticated: boolean;
  isAdmin: boolean;
  role: UserRole | null;
  userId: string | null;
}

function parseUserRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  return VALID_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

export async function getUserAccessContext(): Promise<UserAccessContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      role: null,
      userId: null,
    };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = parseUserRole(profile?.role) ?? parseUserRole(user.user_metadata?.role);

  return {
    isAuthenticated: true,
    isAdmin: role === "admin",
    role,
    userId: user.id,
  };
}

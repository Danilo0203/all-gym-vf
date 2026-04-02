import type { UserRole } from "@/types";

export const VALID_USER_ROLES: UserRole[] = ["admin", "trainer", "employee", "client"];

export function parseUserRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  return VALID_USER_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

export function isClientRole(role: UserRole | null | undefined): role is "client" {
  return role === "client";
}

export function isInternalRole(role: UserRole | null | undefined): role is Exclude<UserRole, "client"> {
  return role === "admin" || role === "trainer" || role === "employee";
}

export function getDefaultRouteForRole(role: UserRole | null | undefined) {
  return isClientRole(role) ? "/mi/rutina" : "/panel/resumen";
}

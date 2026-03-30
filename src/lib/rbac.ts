import { UserRole } from "@/types";

/**
 * Role-based access control utilities
 *
 * These utilities help enforce RBAC on the client side.
 * Note: These are NOT a security measure - they only improve UX.
 * Real security is enforced by:
 * 1. Middleware (src/middleware.ts)
 * 2. RLS policies in Supabase
 */

// Define which roles can access which routes
export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  "/panel/resumen": ["admin", "trainer", "employee", "client"],
  "/panel/usuarios": ["admin"],
  "/panel/clientes": ["admin", "trainer", "employee", "client"],
  "/panel/planes": ["admin"],
  "/panel/pagos": ["admin"],
  "/panel/perfil": ["admin", "trainer", "employee", "client"],
};

/**
 * Check if a user has permission to access a route
 * @param route - The route to check
 * @param userRole - The user's role
 * @returns true if the user can access the route
 */
export function canAccessRoute(route: string, userRole: UserRole): boolean {
  const allowedRoles = ROUTE_PERMISSIONS[route];

  if (!allowedRoles) {
    // If route is not defined, default to allowing all authenticated users
    return true;
  }

  return allowedRoles.includes(userRole);
}

/**
 * Check if a user is an admin
 * @param userRole - The user's role
 * @returns true if the user is an admin
 */
export function isAdmin(userRole: UserRole): boolean {
  return userRole === "admin";
}

/**
 * Check if a user is an employee
 * @param userRole - The user's role
 * @returns true if the user is an employee
 */
export function isEmployee(userRole: UserRole): boolean {
  return userRole === "employee";
}

/**
 * Check if a user is a trainer
 * @param userRole - The user's role
 * @returns true if the user is a trainer
 */
export function isTrainer(userRole: UserRole): boolean {
  return userRole === "trainer";
}

/**
 * Check if a user is a client
 * @param userRole - The user's role
 * @returns true if the user is a client
 */
export function isClient(userRole: UserRole): boolean {
  return userRole === "client";
}

/**
 * Get all routes accessible by a role
 * @param userRole - The user's role
 * @returns Array of accessible routes
 */
export function getAccessibleRoutes(userRole: UserRole): string[] {
  return Object.entries(ROUTE_PERMISSIONS)
    .filter(([, roles]) => roles.includes(userRole))
    .map(([route]) => route);
}

/**
 * Check if a user can perform an action on a resource
 * @param userRole - The user's role
 * @param action - The action to perform (create, read, update, delete)
 * @param resource - The resource type
 * @param resourceOwnerId - Optional: The ID of the resource owner
 * @param userId - Optional: The current user's ID
 * @returns true if the user can perform the action
 */
export function canPerformAction(
  userRole: UserRole,
  action: "create" | "read" | "update" | "delete",
  resource: "profiles" | "plans" | "payments" | "subscriptions" | "clients",
  resourceOwnerId?: string,
  userId?: string,
): boolean {
  // Admin can do everything
  if (isAdmin(userRole)) {
    return true;
  }

  // Resource-specific permissions
  switch (resource) {
    case "profiles":
      // Users can read and update their own profile
      if (action === "read" || action === "update") {
        return resourceOwnerId === userId;
      }
      return false;

    case "plans":
      // All users can read plans
      if (action === "read") {
        return true;
      }
      // Only admin can create, update, delete plans
      return false;

    case "payments":
      // Users can read their own payments
      if (action === "read") {
        return resourceOwnerId === userId;
      }
      // Only admin can create, update, delete payments
      return false;

    case "subscriptions":
      // Users can read their own subscriptions
      if (action === "read") {
        return resourceOwnerId === userId;
      }
      // Only admin can create, update, delete subscriptions
      return false;

    case "clients":
      // All authenticated users can read clients
      if (action === "read") {
        return true;
      }
      // Only admin can create, update, delete clients
      return false;

    default:
      return false;
  }
}

/**
 * Get a user-friendly error message for unauthorized access
 * @param userRole - The user's role
 * @returns Error message
 */
export function getUnauthorizedMessage(userRole: UserRole): string {
  return `No tienes permisos para acceder a esta página. Tu rol actual es "${userRole}". Contacta a un administrador si crees que esto es un error.`;
}

/**
 * Role hierarchy for comparison
 * Higher number = more permissions
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 4,
  trainer: 3,
  employee: 2,
  client: 1,
};

/**
 * Check if a role has higher or equal permissions than another
 * @param userRole - The user's role
 * @param requiredRole - The required role
 * @returns true if userRole >= requiredRole
 */
export function hasRoleOrHigher(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

import { NavItem } from "@/types";

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 *
 * RBAC Access Control:
 * Each navigation item can have an `access` property that controls visibility
 * based on permissions, plans, features, roles, and organization context.
 *
 * Examples:
 *
 * 1. Require organization:
 *    access: { requireOrg: true }
 *
 * 2. Require specific permission:
 *    access: { requireOrg: true, permission: 'org:teams:manage' }
 *
 * 3. Require specific plan:
 *    access: { plan: 'pro' }
 *
 * 4. Require specific feature:
 *    access: { feature: 'premium_access' }
 *
 * 5. Require specific role:
 *    access: { role: 'admin' }
 *
 * 6. Multiple conditions (all must be true):
 *    access: { requireOrg: true, permission: 'org:teams:manage', plan: 'pro' }
 *
 * Note: The `visible` function is deprecated but still supported for backward compatibility.
 * Use the `access` property for new items.
 */
export const navItems: NavItem[] = [
  {
    title: "Tablero",
    url: "/panel/resumen",
    icon: "dashboard",
    isActive: false,
    shortcut: ["d", "d"],
    items: [],
  },
  {
    title: "Clientes",
    url: "/panel/clientes",
    icon: "customers",
    isActive: false,
    items: [],
  },
  {
    title: "Pagos",
    url: "/panel/pagos",
    icon: "billing",
    isActive: false,
    access: { role: ["admin"] },
    items: [],
  },
  {
    title: "Administración",
    url: "#", // Placeholder as there is no direct link for the parent
    icon: "settings",
    isActive: true,
    access: { role: ["admin"] },
    items: [
      {
        title: "Usuarios",
        url: "/panel/usuarios",
        icon: "teams",
      },
      {
        title: "Planes",
        url: "/panel/planes",
        icon: "billing",
      },
      {
        title: "Asistencias",
        url: "/panel/asistencias",
        icon: "dashboard",
      },
      {
        title: "Ejercicios",
        url: "/panel/ejercicios",
        icon: "product",
      },
    ],
  },
  {
    title: "Cuenta",
    url: "#", // Placeholder as there is no direct link for the parent
    icon: "account",
    isActive: true,
    items: [
      {
        title: "Perfil",
        url: "/panel/perfil",
        icon: "profile",
        shortcut: ["m", "m"],
      },
    ],
  },
];

import { useMemo } from "react";
import type { NavItem, UserRole } from "@/types";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";

/**
 * Hook to filter navigation items based on RBAC (client-side)
 *
 * @param items - Array of navigation items to filter
 * @returns Filtered items
 */
export function useFilteredNavItems(items: NavItem[]) {
  const { data: user } = useCurrentUser();

  // Memoize context
  const accessContext = useMemo(() => {
    return {
      role: (user?.role || "client") as UserRole,
      isAuthenticated: !!user,
    };
  }, [user]);

  // Filter items synchronously
  const filteredItems = useMemo(() => {
    if (!accessContext.isAuthenticated) return [];

    return items
      .filter((item) => {
        // No access restrictions
        if (!item.access) {
          return true;
        }

        // Check role
        if (item.access.role) {
          const requiredRoles = Array.isArray(item.access.role) ? item.access.role : [item.access.role];

          if (!requiredRoles.includes(accessContext.role)) {
            return false;
          }
        }

        return true;
      })
      .map((item) => {
        // Recursively filter child items
        if (item.items && item.items.length > 0) {
          const filteredChildren = item.items.filter((childItem) => {
            // No access restrictions
            if (!childItem.access) {
              return true;
            }

            // Check role
            if (childItem.access.role) {
              const requiredRoles = Array.isArray(childItem.access.role)
                ? childItem.access.role
                : [childItem.access.role];

              if (!requiredRoles.includes(accessContext.role)) {
                return false;
              }
            }

            return true;
          });

          return {
            ...item,
            items: filteredChildren,
          };
        }

        return item;
      });
  }, [items, accessContext]);

  return filteredItems;
}

"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessContext } from "@/lib/auth/authorization";
import { revalidatePath } from "next/cache";
import { UserRole } from "@/types";

export interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  last_sign_in_at?: string | null;
}

export interface CreateUserData {
  email: string;
  password?: string;
  full_name: string;
  role: UserRole;
}

export interface UpdateUserData {
  id: string;
  full_name?: string;
  role?: UserRole;
  password?: string;
}

import { ExtendedColumnSort } from "@/types/data-table";

/**
 * Get all users from the profiles table
 * Note: specific columns are selected to avoid over-fetching
 */
export async function getUsers(params?: {
  sort?: ExtendedColumnSort<UserData>[] | null;
}): Promise<{ success: boolean; data?: UserData[]; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!access.isAdmin) {
      return { success: false, error: "No autorizado: Solo administradores" };
    }

    const { sort } = params || {};

    // Use Admin Client to bypass RLS and ensure we get all users
    const adminClient = createAdminClient();
    const sortColumnMap: Partial<Record<string, "full_name" | "role" | "created_at">> = {
      full_name: "full_name",
      role: "role",
      created_at: "created_at",
    };

    // 1. Get profiles with dynamic sorting
    let query = adminClient.from("profiles").select("id, full_name, role, created_at");
    let hasAppliedSort = false;

    if (sort && sort.length > 0) {
      sort.forEach((s) => {
        const column = sortColumnMap[s.id];
        if (column) {
          query = query.order(column, { ascending: !s.desc, nullsFirst: false });
          hasAppliedSort = true;
        }
      });
    }

    if (!hasAppliedSort) {
      query = query.order("created_at", { ascending: false });
    }

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return { success: false, error: profilesError.message };
    }

    // 2. Get Auth Users to get emails
    const {
      data: { users: authUsers },
      error: authError,
    } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

    if (authError) {
      console.error("Error fetching auth users:", authError);
      return { success: false, error: authError.message };
    }

    // 3. Merge data
    const combinedData = profiles.map((profile) => {
      const authUser = authUsers.find((u) => u.id === profile.id);
      return {
        ...profile,
        email: authUser?.email || "Sin email",
      };
    });

    return { success: true, data: combinedData as UserData[] };
  } catch (error) {
    console.error("Error in getUsers:", error);
    return { success: false, error: "Error al obtener usuarios" };
  }
}

/**
 * Create a new user using Supabase Admin API
 */
export async function createUser(data: CreateUserData): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!access.isAdmin) {
      return { success: false, error: "No autorizado: Solo administradores" };
    }

    const adminClient = createAdminClient();

    // 1. Create user in Supabase Auth
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password || "tempPassword123!", // Provide a default if not set? Or require it.
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        role: data.role, // Store role in metadata too for easy access
      },
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return { success: false, error: authError.message };
    }

    if (!authUser.user) {
      return { success: false, error: "No se pudo crear el usuario" };
    }

    // 2. Update profile with role (trigger creates the row, we just update)
    // IMPORTANT: 'email' column does not exist in profiles table
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name: data.full_name,
        role: data.role,
      })
      .eq("id", authUser.user.id);

    if (profileError) {
      // If update fails, maybe the row doesn't exist yet (trigger delay).
      // In that case, we might insert it, but usually triggers are fast.
      console.error("Error updating profile role:", profileError);
      // Try insert if update failed (though trigger should handle it)
    }

    revalidatePath("/panel/usuarios");
    return { success: true };
  } catch (error) {
    console.error("Error in createUser:", error);
    return { success: false, error: "Error inesperado al crear usuario" };
  }
}

/**
 * Update a user
 */
export async function updateUser(data: UpdateUserData): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!access.isAdmin) {
      return { success: false, error: "No autorizado: Solo administradores" };
    }

    const adminClient = createAdminClient();

    // 1. Update Profile data
    const updateData: Pick<UpdateUserData, "full_name" | "role"> = {};
    if (data.full_name) updateData.full_name = data.full_name;
    if (data.role) updateData.role = data.role;

    if (Object.keys(updateData).length > 0) {
      const { error: profileError } = await adminClient.from("profiles").update(updateData).eq("id", data.id);

      if (profileError) {
        return { success: false, error: profileError.message };
      }
    }

    // 2. Update Auth password if provided
    if (data.password) {
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(data.id, {
        password: data.password,
      });

      if (passwordError) {
        return { success: false, error: passwordError.message };
      }
    }

    // Required to sync metadata if we rely on it
    if (data.full_name || data.role) {
      await adminClient.auth.admin.updateUserById(data.id, {
        user_metadata: { full_name: data.full_name, role: data.role },
      });
    }

    revalidatePath("/panel/usuarios");
    return { success: true };
  } catch (error) {
    console.error("Error in updateUser:", error);
    return { success: false, error: "Error inesperado al actualizar usuario" };
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await getUserAccessContext();
    if (!access.isAuthenticated) return { success: false, error: "No autenticado" };
    if (!access.isAdmin) {
      return { success: false, error: "No autorizado: Solo administradores" };
    }

    const adminClient = createAdminClient();

    // Delete from Auth (Cascade should delete from profiles typically, but strictly speaking depends on FK)
    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      console.error("Error deleting user:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/panel/usuarios");
    return { success: true };
  } catch (error) {
    console.error("Error in deleteUser:", error);
    return { success: false, error: "Error inesperado al eliminar usuario" };
  }
}

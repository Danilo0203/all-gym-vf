'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface UpdateProfileData {
  full_name?: string;
  phone?: string;
  birth_date?: string | null;
  gender?: 'male' | 'female' | 'other';
}

/**
 * Get the currently authenticated user's profile data
 */
export async function getCurrentUser(): Promise<{ success: boolean; data?: ProfileData; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Get profile data from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      // Return basic user data if profile doesn't exist
      return {
        success: true,
        data: {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || null,
          phone: null,
          birth_date: null,
          gender: null,
          avatar_url: user.user_metadata?.avatar_url || null,
          role: user.role || 'authenticated',
          created_at: user.created_at,
          updated_at: null,
        }
      };
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email || '',
        full_name: profile.full_name,
        phone: profile.phone,
        birth_date: profile.birth_date,
        gender: profile.gender,
        avatar_url: profile.avatar_url || user.user_metadata?.avatar_url || null,
        role: profile.role || user.role || 'authenticated',
        created_at: user.created_at,
        updated_at: profile.updated_at,
      }
    };
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return { success: false, error: 'Error al obtener datos del usuario' };
  }
}

/**
 * Update the currently authenticated user's profile
 */
export async function updateProfile(data: UpdateProfileData): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Prepare update data
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.full_name !== undefined) updateData.full_name = data.full_name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.birth_date !== undefined) updateData.birth_date = data.birth_date;
    if (data.gender !== undefined) updateData.gender = data.gender;

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return { success: false, error: `Error al actualizar: ${updateError.message}` };
    }

    // Also update auth user metadata for full_name
    if (data.full_name) {
      await supabase.auth.updateUser({
        data: { full_name: data.full_name }
      });
    }

    revalidatePath('/panel/perfil');
    return { success: true };
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return { success: false, error: 'Error inesperado al actualizar perfil' };
  }
}

/**
 * Update the user's password
 */
export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || !user.email) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // First verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return { success: false, error: 'La contraseña actual es incorrecta' };
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      return { success: false, error: `Error al cambiar contraseña: ${updateError.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updatePassword:', error);
    return { success: false, error: 'Error inesperado al cambiar contraseña' };
  }
}

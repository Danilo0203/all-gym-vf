'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface Plan {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  duration_days: number;
  is_active: boolean;
  created_at?: string;
}

export type CreatePlanData = Omit<Plan, 'id' | 'created_at'>;
export type UpdatePlanData = Partial<CreatePlanData>;

export async function getPlans(includeInactive = false) {
  const supabase = await createClient();
  let query = supabase.from('plans').select('*').order('id', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching plans:', error);
    throw new Error('No se pudieron cargar los planes');
  }

  return data as Plan[];
}

export async function getPlanById(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching plan:', error);
    return null;
  }

  return data as Plan;
}

export async function createPlan(data: CreatePlanData) {
  const supabase = await createClient();
  
  const { data: newPlan, error } = await supabase
    .from('plans')
    .insert([
      {
        name: data.name,
        description: data.description,
        price: data.price,
        duration_days: data.duration_days,
        is_active: data.is_active ?? true,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating plan:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/plans');
  return { success: true, data: newPlan };
}

export async function updatePlan(id: number, data: UpdatePlanData) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('plans')
    .update({
      name: data.name,
      description: data.description,
      price: data.price,
      duration_days: data.duration_days,
      is_active: data.is_active,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating plan:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/plans');
  return { success: true };
}

export async function deletePlan(id: number) {
  const supabase = await createClient();
  
  // Realmente no borramos, solo desactivamos para preservar integridad referencial
  // Pero si el usuario explicitamente pide borrar, intentamos borrar.
  // Es mejor práctica hacer soft-delete (desactivar).
  // Por ahora implementaré delete real, si falla por FK, el frontend debería manejarlo.
  
  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting plan:', error);
    // Si falla por FK, intentamos desactivar
    if (error.code === '23503') { // Foreign key violation
        const { error: updateError } = await supabase
            .from('plans')
            .update({ is_active: false })
            .eq('id', id);
            
        if (updateError) return { success: false, error: 'No se pudo eliminar ni desactivar el plan.' };
        
        revalidatePath('/dashboard/plans');
        return { success: true, message: 'Plan desactivado porque tiene clientes asociados.' };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/plans');
  return { success: true };
}

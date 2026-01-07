'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCustomerById, createCustomer, updateCustomer, CreateCustomerData } from '../actions/customer-actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export const customersKeys = {
  all: ['customers'] as const,
  lists: () => [...customersKeys.all, 'list'] as const,
  detail: (id: string) => [...customersKeys.all, 'detail', id] as const,
};

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: customersKeys.detail(id || ''),
    queryFn: () => getCustomerById(id!),
    enabled: !!id, // Solo ejecutar si hay ID
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: CreateCustomerData) => {
        const result = await createCustomer(data);
        if (!result.success) {
            throw new Error(result.error || 'Error al crear');
        }
        return result;
    },
    onSuccess: (result) => {
        // Asumiendo que createCustomer puede devolver void o un objeto
        // Revisaremos la implementación actual de createCustomer
        toast.success('Cliente creado exitosamente');
        queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
        router.refresh();
    },
    onError: (error) => {
      console.error(error);
      toast.error(error.message || 'Error al crear el cliente');
    }
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCustomerData> }) => {
      // Si hay una contraseña en los datos, obtener el token de acceso del cliente
      let accessToken: string | undefined;
      
      if (data.password && data.password.length >= 6) {
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        accessToken = sessionData?.session?.access_token;
        
        if (!accessToken) {
          toast.error('Sesión expirada. Por favor inicia sesión nuevamente.');
          router.push('/login');
          throw new Error('Sesión expirada');
        }
      }
      
      const result = await updateCustomer(id, data, accessToken);
      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar');
      }
      return result;
    },
    onSuccess: (result, variables) => {
      toast.success('Cliente actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: customersKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: customersKeys.lists() });
      router.refresh();
    },
    onError: (error) => {
      console.error(error);
      toast.error(error.message || 'Error al actualizar el cliente');
    }
  });
}

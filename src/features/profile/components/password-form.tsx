'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/forms/form-input';
import { useUpdatePassword } from '../hooks/use-profile';
import { IconLoader2, IconLock } from '@tabler/icons-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu nueva contraseña'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function PasswordForm() {
  const updatePassword = useUpdatePassword();

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    await updatePassword.mutateAsync({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    
    // Reset form on success
    form.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar Contraseña</CardTitle>
        <CardDescription>
          Actualiza tu contraseña para mantener tu cuenta segura.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              control={form.control}
              name="currentPassword"
              label="Contraseña Actual"
              type="password"
              placeholder="••••••••"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                control={form.control}
                name="newPassword"
                label="Nueva Contraseña"
                type="password"
                placeholder="••••••••"
              />
              <FormInput
                control={form.control}
                name="confirmPassword"
                label="Confirmar Contraseña"
                type="password"
                placeholder="••••••••"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updatePassword.isPending} variant="outline">
                {updatePassword.isPending ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconLock className="mr-2 h-4 w-4" />
                )}
                Cambiar Contraseña
              </Button>
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}

'use client';

import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { FormTextarea } from '@/components/forms/form-textarea';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// Profile type for this form (different from view type)
interface ProfileFormData {
  id?: string;
  full_name: string | null;
  phone: string | null;
  birth_date?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  injuries?: string | null;
  medical_notes?: string | null;
}

const formSchema = z.object({
  full_name: z.string().min(2, {
    message: 'El nombre debe tener al menos 2 caracteres.'
  }),
  phone: z.string().optional().or(z.literal('')),
  birth_date: z.date().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  emergency_contact: z.string().optional().or(z.literal('')),
  emergency_phone: z.string().optional().or(z.literal('')),
  injuries: z.string().optional().or(z.literal('')),
  medical_notes: z.string().optional().or(z.literal('')),
});

export default function CustomerForm({
  initialData,
  pageTitle
}: {
  initialData: ProfileFormData | null;
  pageTitle: string;
}) {
  const defaultValues = {
    full_name: initialData?.full_name || '',
    phone: initialData?.phone || '',
    birth_date: initialData?.birth_date ? new Date(initialData.birth_date) : undefined,
    gender: initialData?.gender || 'male',
    emergency_contact: initialData?.emergency_contact || '',
    emergency_phone: initialData?.emergency_phone || '',
    injuries: initialData?.injuries || '',
    medical_notes: initialData?.medical_notes || '',
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues
  });

  const router = useRouter();

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Form submission logic (Supabase update)
    console.log(values);
    // TODO: Implement Supabase update for profiles
    router.push('/dashboard/customers');
  }

  return (
    <Card className='mx-auto w-full'>
      <CardHeader>
        <CardTitle className='text-left text-2xl font-bold'>
          {pageTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form
          form={form}
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6'
        >
          <FormInput
            control={form.control}
            name='full_name'
            label='Nombre Completo'
            placeholder='Ej: Juan Pérez'
            required
          />

          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <FormInput
              control={form.control}
              name='phone'
              label='Teléfono'
              placeholder='Ej: 555-1234'
            />
            <FormDatePicker
              control={form.control}
              name='birth_date'
              label='Fecha de Nacimiento'
            />
          </div>

          <FormSelect
            control={form.control}
            name='gender'
            label='Género'
            placeholder='Seleccionar género'
            options={[
              { label: 'Masculino', value: 'male' },
              { label: 'Femenino', value: 'female' },
              { label: 'Otro', value: 'other' }
            ]}
          />

          <div className='pt-4 border-t'>
            <h4 className='text-sm font-medium mb-4'>Contacto de Emergencia</h4>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <FormInput
                control={form.control}
                name='emergency_contact'
                label='Nombre del Contacto'
                placeholder='Nombre del contacto'
              />
              <FormInput
                control={form.control}
                name='emergency_phone'
                label='Teléfono del Contacto'
                placeholder='Teléfono del contacto'
              />
            </div>
          </div>

          <div className='pt-4 border-t'>
            <h4 className='text-sm font-medium mb-4'>Información Médica</h4>
            <div className='space-y-4'>
              <FormTextarea
                control={form.control}
                name='injuries'
                label='Lesiones'
                placeholder='Describe lesiones previas o actuales...'
                config={{ rows: 3 }}
              />
              <FormTextarea
                control={form.control}
                name='medical_notes'
                label='Notas Médicas'
                placeholder='Alergias, condiciones médicas, etc...'
                config={{ rows: 3 }}
              />
            </div>
          </div>

          <div className='flex gap-4 pt-4'>
            <Button type='button' variant='outline' onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type='submit'>Guardar Cliente</Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}

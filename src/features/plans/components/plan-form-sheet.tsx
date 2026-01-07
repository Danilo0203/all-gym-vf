'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormInput } from '@/components/forms/form-input';
import { FormTextarea } from '@/components/forms/form-textarea';
import { Switch } from '@/components/ui/switch';
import { IconPlus, IconLoader2, IconEdit } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plan } from '../actions/plan-actions'; 
import { useCreatePlan, useUpdatePlan } from '../hooks/use-plans';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

const planFormSchema = z.object({
  name: z.string().min(2, { message: 'El nombre es obligatorio' }),
  description: z.string().optional(),
  price: z.coerce.number().min(0, { message: 'El precio debe ser mayor o igual a 0' }),
  duration_days: z.coerce.number().min(1, { message: 'La duración debe ser al menos 1 día' }),
  is_active: z.boolean().default(true),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

interface PlanFormSheetProps {
  mode?: 'create' | 'edit';
  plan?: Plan | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PlanFormSheet({ 
  mode = 'create', 
  plan = null,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: PlanFormSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const router = useRouter();
  
  const { mutateAsync: createPlanMutation, isPending: isCreating } = useCreatePlan();
  const { mutateAsync: updatePlanMutation, isPending: isUpdating } = useUpdatePlan();
  
  const isPending = isCreating || isUpdating;

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange || setInternalOpen) : setInternalOpen;
  
  const isEditing = mode === 'edit' && plan !== null;

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      duration_days: 30,
      is_active: true,
    }
  });

  useEffect(() => {
    if (open) {
      if (isEditing && plan) {
        form.reset({
          name: plan.name,
          description: plan.description || '',
          price: plan.price,
          duration_days: plan.duration_days,
          is_active: plan.is_active,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          price: 0,
          duration_days: 30,
          is_active: true,
        });
      }
    }
  }, [open, isEditing, plan, form]);

  async function onSubmit(values: PlanFormValues) {
    try {
      let result;
      if (isEditing && plan) {
        result = await updatePlanMutation({ id: plan.id, data: values });
      } else {
        result = await createPlanMutation(values);
      }
      
      if (result.success) {
        setOpen(false);
      }
    } catch (error) {
      // El hook ya maneja el toast de error en onError
      console.error('Submit error:', error);
    }
  }

  const defaultTrigger = (
    <Button size="sm">
      <IconPlus className='mr-2 h-4 w-4' /> Nuevo Plan
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>
      ) : (
        <SheetTrigger asChild>{defaultTrigger}</SheetTrigger>
      )}
      <SheetContent className='sm:max-w-md w-full flex flex-col h-full'>
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Plan' : 'Crear Nuevo Plan'}</SheetTitle>
          <SheetDescription>
            {isEditing 
                ? 'Modifica los detalles del plan de membresía.' 
                : 'Configura un nuevo plan de membresía para tus clientes.'}
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className='flex-1 pr-4'>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6 py-4'>
                <FormInput 
                    control={form.control as any} 
                    name='name' 
                    label='Nombre del Plan' 
                    placeholder='Ej. Mensual VIP' 
                />
                
                <div className='grid grid-cols-2 gap-4'>
                    <FormInput 
                        control={form.control as any} 
                        name='price' 
                        label='Precio (Q)' 
                        type='number' 
                        placeholder='0.00'
                    />
                    <FormInput 
                        control={form.control as any} 
                        name='duration_days' 
                        label='Duración (Días)' 
                        type='number' 
                        placeholder='30'
                    />
                </div>

                <FormTextarea 
                    control={form.control as any} 
                    name='description' 
                    label='Descripción' 
                    placeholder='Detalles opcionales del plan...' 
                />

                <FormField
                    control={form.control as any}
                    name="is_active"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base">Plan Activo</FormLabel>
                            <SheetDescription>
                                Si está desactivado, no aparecerá para nuevos clientes.
                            </SheetDescription>
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        </FormItem>
                    )}
                />
            </form>
            </Form>
        </ScrollArea>

        <SheetFooter className="border-t pt-4">
          <SheetClose asChild>
            <Button variant='outline' disabled={isPending}>Cancelar</Button>
          </SheetClose>
          <Button type='submit' disabled={isPending} onClick={form.handleSubmit(onSubmit)}>
            {isPending && <IconLoader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isEditing ? 'Guardar Cambios' : 'Crear Plan'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

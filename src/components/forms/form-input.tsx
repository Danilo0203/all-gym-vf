'use client';

import { FieldPath, FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { BaseFormFieldProps } from '@/types/base-form';

interface FormInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
}

function FormInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  required,
  type = 'text',
  placeholder,
  step,
  min,
  max,
  disabled,
  className
}: FormInputProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </FormLabel>
          )}
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              step={step}
              min={min}
              max={max}
              disabled={disabled}
              {...field}
              // Para campos numéricos: mostrar vacío si es 0, undefined o null
              // Para otros campos: mostrar vacío solo si es undefined o null
              value={
                type === 'number' 
                  ? (field.value === 0 || field.value === undefined || field.value === null ? '' : field.value)
                  : (field.value ?? '')
              }
              onChange={(e) => {
                if (type === 'number') {
                  const value = e.target.value;
                  // Permitir campo vacío (será manejado por validación Zod)
                  field.onChange(value === '' ? undefined : parseFloat(value));
                } else {
                  field.onChange(e.target.value);
                }
              }}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { FormInput };

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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group';
import { BaseFormFieldProps } from '@/types/base-form';

interface FormInputGroupProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
  addonText?: string;
  addonTextPosition?: 'start' | 'end';
}

function FormInputGroup<
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
  className,
  icon,
  iconPosition = 'start',
  addonText,
  addonTextPosition = 'start'
}: FormInputGroupProps<TFieldValues, TName>) {
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
            <InputGroup data-disabled={disabled}>
              {/* Icon at start */}
              {icon && iconPosition === 'start' && (
                <InputGroupAddon align="inline-start">
                  {icon}
                </InputGroupAddon>
              )}
              
              {/* Text addon at start */}
              {addonText && addonTextPosition === 'start' && (
                <InputGroupAddon align="inline-start">
                  <InputGroupText>{addonText}</InputGroupText>
                </InputGroupAddon>
              )}
              
              <InputGroupInput
                type={type}
                placeholder={placeholder}
                step={step}
                min={min}
                max={max}
                disabled={disabled}
                {...field}
                value={
                  type === 'number' 
                    ? (field.value === 0 || field.value === undefined || field.value === null || (typeof field.value === 'number' && isNaN(field.value)) ? '' : field.value)
                    : (field.value ?? '')
                }
                onChange={(e) => {
                  if (type === 'number') {
                    const value = e.target.value;
                    // Allow empty input (will be 0 when submitted via schema default)
                    if (value === '') {
                      field.onChange(0);
                    } else {
                      const num = parseFloat(value);
                      field.onChange(isNaN(num) ? 0 : num);
                    }
                  } else {
                    field.onChange(e.target.value);
                  }
                }}
              />
              
              {/* Icon at end */}
              {icon && iconPosition === 'end' && (
                <InputGroupAddon align="inline-end">
                  {icon}
                </InputGroupAddon>
              )}
              
              {/* Text addon at end */}
              {addonText && addonTextPosition === 'end' && (
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{addonText}</InputGroupText>
                </InputGroupAddon>
              )}
            </InputGroup>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { FormInputGroup };

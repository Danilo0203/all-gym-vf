"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormInputGroup } from "@/components/forms/form-input-group";
import { FormSelect } from "@/components/forms/form-select";
import { FormTextarea } from "@/components/forms/form-textarea";
import {
  IconPlus,
  IconLoader2,
  IconCalendar,
  IconMail,
  IconLock,
  IconUser,
  IconPhone,
  IconScale,
  IconRuler,
  IconDiscount,
} from "@tabler/icons-react";
import { useState, useEffect, useRef, useCallback } from "react";

import { useCreateCustomer, useUpdateCustomer, useReactivateCustomer } from "../hooks/use-customers";
import { usePlans } from "@/features/plans/hooks/use-plans";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDays, format, parse, isValid, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { computeFitnessPlan } from "@/lib/fitness/excel-calculator";
import type { CreateCustomerData } from "@/features/customers/actions/customer-actions";

const customerFormSchema = z.object({
  // 1. Datos de Cuenta
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }).optional().or(z.literal("")),

  // 2. Datos Personales
  full_name: z.string().min(2, { message: "El nombre es obligatorio" }),
  birth_date: z.date({ message: "La fecha de nacimiento es obligatoria" }),
  gender: z.enum(["male", "female", "other"], { message: "Selecciona el género" }),
  phone: z.string().regex(/^\d{8}$/, { message: "El teléfono debe tener exactamente 8 dígitos" }),

  // 3. Datos de Inscripción
  plan_id: z.string({ message: "Selecciona un plan" }).min(1, { message: "Selecciona un plan" }),
  final_price: z.number({ message: "El precio es obligatorio" }),
  discount_amount: z.coerce.number().min(0).default(0),
  payment_method: z.enum(["cash", "card", "transfer"], { message: "Selecciona el método de pago" }),

  // Rango de Fechas
  subscription_period: z.object({
    from: z.date({ message: "La fecha de inicio es obligatoria" }),
    to: z.date({ message: "La fecha de fin es obligatoria" }),
  }),

  // 4. Datos Físicos
  weight_kg: z.coerce.number({ message: "El peso es obligatorio" }).positive({ message: "El peso debe ser mayor a 0" }),
  height_cm: z.coerce
    .number({ message: "La estatura es obligatoria" })
    .positive({ message: "La estatura debe ser mayor a 0" }),
  diet_type: z.enum(["hipocalorica", "normocalorica", "hipercalorica"], { message: "Selecciona tipo de dieta" }),
  activity_level: z.enum(["sedentario", "1_3_dias", "3_5_dias", "6_7_dias", "2_veces_dia"], {
    message: "Selecciona nivel de actividad",
  }),
  body_fat_percentage: z.coerce.number().min(1, { message: "Ingresa % de grasa" }).max(100),
  muscle_mass_kg: z.coerce.number().positive({ message: "Ingresa masa muscular" }),
  chest: z.coerce.number().positive({ message: "Ingresa pecho" }),
  waist: z.coerce.number().positive({ message: "Ingresa cintura" }),
  hip: z.coerce.number().positive({ message: "Ingresa cadera" }),
  arm_right: z.coerce.number().positive({ message: "Ingresa brazo derecho" }),
  arm_left: z.coerce.number().positive({ message: "Ingresa brazo izquierdo" }),
  leg_right: z.coerce.number().positive({ message: "Ingresa pierna derecha" }),
  leg_left: z.coerce.number().positive({ message: "Ingresa pierna izquierda" }),
  injuries: z.string().optional().or(z.literal("")), // Opcional
  notes: z.string().optional().or(z.literal("")),
  body_type: z.enum(["ectomorph", "mesomorph", "endomorph"], { message: "Selecciona el somatotipo" }),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

// Tipo para los datos del cliente que se pasan al sheet para editar
export interface CustomerData {
  id: string;
  is_active?: boolean | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  // Datos de suscripción (si están disponibles)
  plan_id?: number | null;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  discount_amount?: number | null;
  final_price?: number | null;
  payment_method?: string | null;
  // Datos físicos
  weight_kg?: number | null;
  height_cm?: number | null;
  injuries?: string | null;
  body_type?: string | null;
  diet_type?: string | null;
  activity_level?: string | null;
  body_fat_percentage?: number | null;
  muscle_mass_kg?: number | null;
  chest?: number | null;
  waist?: number | null;
  hip?: number | null;
  arm_right?: number | null;
  arm_left?: number | null;
  leg_right?: number | null;
  leg_left?: number | null;
  notes?: string | null;
}

interface CustomerFormSheetProps {
  mode?: "create" | "edit";
  customer?: CustomerData | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function DatePickerInput({ value, onChange }: { value?: Date; onChange: (date?: Date) => void }) {
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);
  const displayedValue = inputValue ?? (value && isValid(value) ? format(value, "dd/MM/yyyy") : "");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (val.length === 10) {
      const parsed = parse(val, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        onChange(parsed);
      }
    } else if (val === "") {
      onChange(undefined);
    }
  };

  return (
    <InputGroup>
      <InputGroupInput
        value={displayedValue}
        onChange={handleInputChange}
        onBlur={() => setInputValue(undefined)}
        placeholder="DD/MM/YYYY"
        maxLength={10}
      />
      <InputGroupAddon align="inline-end">
        <Popover modal={false}>
          <PopoverTrigger asChild>
            <InputGroupButton variant="ghost" size="icon-sm" className="shrink-0" tabIndex={-1}>
              <IconCalendar className="h-4 w-4 opacity-50" />
            </InputGroupButton>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => {
                onChange(date);
                setInputValue(undefined);
              }}
              autoFocus
              locale={es}
              captionLayout="dropdown"
              startMonth={new Date(1920, 0)}
              endMonth={new Date()}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  );
}

export function CustomerFormSheet({
  mode = "create",
  customer = null,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CustomerFormSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedPlanPrice, setSelectedPlanPrice] = useState<number>(0);
  const [userModifiedDates, setUserModifiedDates] = useState(false);
  const previousPlanId = useRef<string | null>(null);

  // Hooks de React Query
  const { data: plans = [] } = usePlans(true);
  const { mutateAsync: createCustomerMutation, isPending: isCreating } = useCreateCustomer();
  const { mutateAsync: updateCustomerMutation, isPending: isUpdating } = useUpdateCustomer();
  const { mutateAsync: reactivateCustomerMutation } = useReactivateCustomer();

  const isPending = isCreating || isUpdating;

  // Controlar si el estado es controlado externamente o interno
  const isControlled = controlledOpen !== undefined;
  const requestedOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange || setInternalOpen : setInternalOpen;

  // Prevent opening the sheet in edit mode until customer data is available
  // This avoids the "flash" of the create form or empty state
  const isDataReady = mode === "create" || (mode === "edit" && !!customer);
  const open = requestedOpen && isDataReady;

  const isEditing = mode === "edit" && customer !== null;

  // Helper para parsear fechas "YYYY-MM-DD" localmente sin conversión a UTC
  const parseDatabaseDate = (dateString: Date | string | null | undefined): Date | undefined => {
    if (!dateString) return undefined;

    // Si ya es un objeto Date
    if (dateString instanceof Date) return dateString;

    // Intentar split manual YYYY-MM-DD
    if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    // Fallback estándar
    const date = new Date(dateString);
    return isValid(date) ? date : undefined;
  };

  const getDefaultValues = useCallback((): CustomerFormValues => {
    if (isEditing && customer) {
      return {
        email: customer.email || "",
        password: "",
        full_name: customer.full_name || "",
        gender: (customer.gender as "male" | "female" | "other") || "male",
        phone: customer.phone || "",
        birth_date: parseDatabaseDate(customer.birth_date) || new Date(),
        plan_id: customer.plan_id?.toString() || "",
        final_price: customer.final_price ?? 0,
        discount_amount: customer.discount_amount ?? 0,
        payment_method: (customer.payment_method as "cash" | "card" | "transfer") || "cash",
        injuries: customer.injuries || "",
        weight_kg: customer.weight_kg ?? 0,
        height_cm: customer.height_cm ?? 0,
        body_type: (customer.body_type as "ectomorph" | "mesomorph" | "endomorph") || "",
        diet_type: (customer.diet_type as "hipocalorica" | "normocalorica" | "hipercalorica") || "normocalorica",
        activity_level:
          (customer.activity_level as "sedentario" | "1_3_dias" | "3_5_dias" | "6_7_dias" | "2_veces_dia") ||
          "3_5_dias",
        body_fat_percentage: customer.body_fat_percentage ?? 0,
        muscle_mass_kg: customer.muscle_mass_kg ?? 0,
        chest: customer.chest ?? 0,
        waist: customer.waist ?? 0,
        hip: customer.hip ?? 0,
        arm_right: customer.arm_right ?? 0,
        arm_left: customer.arm_left ?? 0,
        leg_right: customer.leg_right ?? 0,
        leg_left: customer.leg_left ?? 0,
        notes: customer.notes || "",
        subscription_period: {
          from: parseDatabaseDate(customer.subscription_start_date) || new Date(),
          to: parseDatabaseDate(customer.subscription_end_date) || new Date(),
        },
      };
    }
    return {
      email: "",
      password: "",
      full_name: "",
      gender: "male",
      phone: "",
      birth_date: new Date(),
      plan_id: "",
      discount_amount: 0,
      payment_method: "cash",
      final_price: 0,
      injuries: "",
      weight_kg: 0,
      height_cm: 0,
      diet_type: "normocalorica",
      activity_level: "3_5_dias",
      body_fat_percentage: 0,
      muscle_mass_kg: 0,
      chest: 0,
      waist: 0,
      hip: 0,
      arm_right: 0,
      arm_left: 0,
      leg_right: 0,
      leg_left: 0,
      body_type: undefined as unknown as "ectomorph" | "mesomorph" | "endomorph",
      notes: "",
      subscription_period: {
        from: new Date(),
        to: new Date(),
      },
    };
  }, [isEditing, customer]);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema) as Resolver<CustomerFormValues>,
    defaultValues: getDefaultValues(),
  });

  // Resetear formulario al abrir y gestionar planes
  useEffect(() => {
    if (open) {
      const vals = getDefaultValues();
      form.reset(vals);

      // Si estamos editando y tenemos planes cargados
      if (isEditing && customer?.plan_id) {
        const currentPlan = plans.find((p) => p.id.toString() === customer.plan_id?.toString());
        if (currentPlan) {
          setSelectedPlanPrice(currentPlan.price);
        }
      }

      if (isEditing && customer?.subscription_start_date) {
        // Si estamos editando, NO marcar como modificado por usuario inicialmente,
        // para permitir que si cambia el plan, se recalculen las fechas.
        setUserModifiedDates(false);
      } else {
        setUserModifiedDates(false);
      }

      previousPlanId.current = customer?.plan_id?.toString() || null;
    }
  }, [open, isEditing, customer, form, getDefaultValues, plans]);

  // Observar cambios
  const watchedPlanId = form.watch("plan_id");
  const watchedDiscount = form.watch("discount_amount");
  const watchedWeight = form.watch("weight_kg");
  const watchedHeight = form.watch("height_cm");
  const watchedBodyType = form.watch("body_type");
  const watchedDietType = form.watch("diet_type");
  const watchedActivityLevel = form.watch("activity_level");
  const watchedBirthDate = form.watch("birth_date");
  const watchedGender = form.watch("gender");

  // Cuando cambia el plan, actualizar fechas (solo si el usuario no las modificó manualmente)
  useEffect(() => {
    if (!watchedPlanId) return;

    // Si el plan cambió (no es el mismo que antes), recalcular fechas
    const planChanged = previousPlanId.current !== watchedPlanId;
    previousPlanId.current = watchedPlanId;

    const selectedPlan = plans.find((p) => p.id.toString() === watchedPlanId);

    if (selectedPlan) {
      // Siempre actualizar el precio
      setSelectedPlanPrice(selectedPlan.price);

      // Solo auto-calcular fechas si:
      // 1. El plan cambió, y
      // 2. El usuario no ha modificado manualmente las fechas
      if (planChanged && !userModifiedDates) {
        const startDate = form.getValues("subscription_period.from") || new Date();
        const endDate = addDays(startDate, selectedPlan.duration_days);
        form.setValue("subscription_period", {
          from: startDate,
          to: endDate,
        });
      }
    }
  }, [watchedPlanId, plans, form, userModifiedDates]);

  // Calcular Precio Final Automáticamente (con validación de descuento máximo)
  const calculationPreview =
    watchedWeight &&
    watchedHeight &&
    watchedBodyType &&
    watchedDietType &&
    watchedActivityLevel &&
    watchedBirthDate &&
    watchedGender
      ? computeFitnessPlan({
          birthDate: watchedBirthDate,
          gender: watchedGender,
          weightKg: watchedWeight,
          heightCm: watchedHeight,
          bodyType: watchedBodyType,
          dietType: watchedDietType,
          activityLevel: watchedActivityLevel,
        })
      : null;

  useEffect(() => {
    const discount = Number(watchedDiscount) || 0;
    const final = Math.max(0, selectedPlanPrice - discount);
    form.setValue("final_price", final, { shouldValidate: false });

    // Validar que el descuento no sea mayor que el precio del plan
    if (discount > selectedPlanPrice && selectedPlanPrice > 0) {
      form.setError("discount_amount", {
        type: "manual",
        message: `El descuento no puede ser mayor al precio del plan (Q${selectedPlanPrice.toFixed(2)})`,
      });
    } else {
      form.clearErrors("discount_amount");
    }
  }, [selectedPlanPrice, watchedDiscount, form]);

  // Handler para cuando el usuario modifica las fechas manualmente
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range) {
      setUserModifiedDates(true);
      form.setValue("subscription_period", {
        from: range.from || new Date(),
        to: range.to || range.from || new Date(),
      });
    }
  };

  async function onSubmit(values: CustomerFormValues) {
    try {
      const payload: CreateCustomerData = {
        email: values.email,
        password: values.password || undefined,
        full_name: values.full_name,
        phone: values.phone,
        birth_date: values.birth_date,
        gender: values.gender,

        plan_id: Number(values.plan_id),
        final_price: values.final_price,
        discount_amount: values.discount_amount,
        payment_method: values.payment_method,

        start_date: values.subscription_period?.from,
        end_date: values.subscription_period?.to,

        weight_kg: values.weight_kg,
        height_cm: values.height_cm,
        diet_type: values.diet_type,
        activity_level: values.activity_level,
        body_fat_percentage: values.body_fat_percentage,
        muscle_mass_kg: values.muscle_mass_kg,
        chest: values.chest,
        waist: values.waist,
        hip: values.hip,
        arm_right: values.arm_right,
        arm_left: values.arm_left,
        leg_right: values.leg_right,
        leg_left: values.leg_left,
        injuries: values.injuries || undefined,
        notes: values.notes || undefined,
        body_type: values.body_type,
      };

      if (isEditing && customer?.id) {
        await updateCustomerMutation({ id: customer.id, data: payload });
      } else {
        await createCustomerMutation(payload);
      }

      setOpen(false);
    } catch (error) {
      console.error("Submit error:", error);
    }
  }

  const subscriptionPeriod = form.watch("subscription_period");

  // Trigger por defecto para modo crear
  const defaultTrigger = (
    <Button className="text-xs md:text-sm">
      <IconPlus className="mr-2 h-4 w-4" /> Nuevo Cliente
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>
      ) : ( 
        <SheetTrigger asChild>{defaultTrigger}</SheetTrigger>
      )}
      <SheetContent className="sm:max-w-xl w-full flex flex-col h-full p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b space-y-1 sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <SheetTitle>{isEditing ? "Editar Cliente" : "Registro de Nuevo Cliente"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifica los datos del cliente. Los cambios se guardarán automáticamente."
              : "Completa la ficha de inscripción. El precio y fechas se calculan según el plan."}
          </SheetDescription>
        </SheetHeader>

        {isEditing && customer?.is_active === false && (
          <div className="bg-destructive/10 px-6 py-3 flex items-center justify-between border-b border-destructive/20">
            <span className="text-sm text-destructive font-medium">Este cliente está inactivo.</span>
            <Button
              size="sm"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-white h-7"
              onClick={async () => {
                if (!customer?.id) return;
                try {
                  const result = await reactivateCustomerMutation(customer.id);
                  if (result.success) {
                    setOpen(false);
                  }
                } catch {
                  // Error handled by hook
                }
              }}
            >
              Activar Cliente
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
              {/* 1. LOGIN */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    1
                  </span>
                  Cuenta
                </h4>
                <div className="grid grid-cols-2 gap-4 pl-4">
                  <FormInputGroup
                    control={form.control}
                    name="email"
                    label="Email"
                    placeholder="user@gym.com"
                    type="email"
                    icon={<IconMail className="h-4 w-4" />}
                    disabled={isEditing}
                  />
                  <FormInputGroup
                    control={form.control}
                    name="password"
                    label={isEditing ? "Nueva Contraseña" : "Contraseña"}
                    placeholder={isEditing ? "(Dejar vacío para no cambiar)" : "(Opcional)"}
                    type="password"
                    icon={<IconLock className="h-4 w-4" />}
                  />
                </div>
              </div>

              <Separator />

              {/* 2. DATOS PERSONALES */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    2
                  </span>
                  Datos Personales
                </h4>
                <div className="grid grid-cols-2 gap-4 pl-4">
                  <FormInputGroup
                    control={form.control}
                    name="full_name"
                    label="Nombre Completo"
                    placeholder="Nombre Apellido"
                    icon={<IconUser className="h-4 w-4" />}
                  />
                  <FormField
                    control={form.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col w-full">
                        <FormLabel>Nacimiento</FormLabel>
                        <FormControl>
                          <DatePickerInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormSelect
                    control={form.control}
                    name="gender"
                    label="Género"
                    options={[
                      { label: "Masculino", value: "male" },
                      { label: "Femenino", value: "female" },
                      { label: "Otro", value: "other" },
                    ]}
                  />
                  <FormInputGroup
                    control={form.control}
                    name="phone"
                    label="Teléfono"
                    required
                    placeholder="12345678"
                    type="tel"
                    maxLength={8}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    icon={<IconPhone className="h-4 w-4" />}
                  />
                </div>
              </div>

              <Separator />

              {/* 3. MEMBRESÍA Y PAGOS */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    3
                  </span>
                  Membresía
                </h4>
                <div className="space-y-4 pl-4">
                  {/* Selección de Plan */}
                  <FormSelect
                    control={form.control}
                    name="plan_id"
                    label="Seleccionar Plan"
                    placeholder="Elige un plan..."
                    options={plans.map((p) => ({
                      label: `${p.name} - Q${p.price} (${p.duration_days} días)`,
                      value: p.id.toString(),
                    }))}
                  />

                  {/* CALENDARIO DE RANGO */}
                  <FormField
                    control={form.control}
                    name="subscription_period"
                    render={({ field }) => {
                      const from = field.value?.from;
                      const to = field.value?.to;
                      const daysDiff = from && to ? differenceInDays(to, from) : 0;

                      // Handlers for individual date inputs
                      const handleStartChange = (date?: Date) => {
                        setUserModifiedDates(true);
                        form.setValue("subscription_period", {
                          from: date || new Date(),
                          to: field.value?.to || date || new Date(),
                        });
                      };

                      const handleEndChange = (date?: Date) => {
                        setUserModifiedDates(true);
                        form.setValue("subscription_period", {
                          from: field.value?.from || new Date(),
                          to: date || new Date(),
                        });
                      };

                      // Presets for subscription periods
                      const applyPreset = (days: number) => {
                        setUserModifiedDates(true);
                        const start = new Date();
                        const end = addDays(start, days);
                        form.setValue("subscription_period", {
                          from: start,
                          to: end,
                        });
                      };

                      return (
                        <FormItem className="flex flex-col">
                          <FormLabel>Vigencia de Suscripción</FormLabel>
                          <div className="grid grid-cols-[1fr_1fr_auto_80px] gap-2 items-center">
                            {/* Fecha Inicio */}
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Inicio</span>
                              <DatePickerInput value={from} onChange={handleStartChange} />
                            </div>

                            {/* Fecha Fin */}
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Fin</span>
                              <DatePickerInput value={to} onChange={handleEndChange} />
                            </div>

                            {/* Botón Calendario Range con Presets */}
                            <Popover modal={false}>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="outline" size="icon" className="mt-5">
                                  <IconCalendar className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <div className="flex">
                                  {/* Presets sidebar */}
                                  <div className="flex flex-col border-r p-2 min-w-[130px]">
                                    <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Períodos</p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="justify-start font-normal text-xs h-8"
                                      onClick={() => applyPreset(7)}
                                    >
                                      1 semana
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="justify-start font-normal text-xs h-8"
                                      onClick={() => applyPreset(15)}
                                    >
                                      15 días
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="justify-start font-normal text-xs h-8"
                                      onClick={() => applyPreset(30)}
                                    >
                                      1 mes
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="justify-start font-normal text-xs h-8"
                                      onClick={() => applyPreset(60)}
                                    >
                                      2 meses
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="justify-start font-normal text-xs h-8"
                                      onClick={() => applyPreset(90)}
                                    >
                                      3 meses
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="justify-start font-normal text-xs h-8"
                                      onClick={() => applyPreset(180)}
                                    >
                                      6 meses
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="justify-start font-normal text-xs h-8"
                                      onClick={() => applyPreset(365)}
                                    >
                                      1 año
                                    </Button>
                                  </div>

                                  {/* Calendar */}
                                  <Calendar
                                    autoFocus
                                    mode="range"
                                    defaultMonth={from}
                                    selected={subscriptionPeriod}
                                    onSelect={handleDateRangeChange}
                                    numberOfMonths={2}
                                    locale={es}
                                  />
                                </div>
                              </PopoverContent>
                            </Popover>

                            {/* Días */}
                            <div className="flex flex-col gap-1 mt-5">
                              <div className="h-9 flex items-center justify-center px-2 border rounded-md bg-muted text-muted-foreground font-medium text-sm">
                                {daysDiff} días
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  {/* Cálculos de Precio */}
                  <div className="grid grid-cols-3 gap-4 items-end bg-muted/30 p-3 rounded-md">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Precio Plan</label>
                      <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-muted-foreground font-semibold">
                        Q{selectedPlanPrice.toFixed(2)}
                      </div>
                    </div>

                    <FormInputGroup
                      control={form.control}
                      name="discount_amount"
                      label="Descuento"
                      type="number"
                      min={0}
                      placeholder="0.00"
                      icon={<IconDiscount className="h-4 w-4" />}
                    />

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-primary">Precio Final</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-bold">Q</span>
                        <input
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-7 py-2 text-sm font-bold text-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled
                          value={form.watch("final_price")?.toFixed(2) || "0.00"}
                        />
                      </div>
                    </div>
                  </div>

                  <FormSelect
                    control={form.control}
                    name="payment_method"
                    label="Método de Pago"
                    options={[
                      { label: "Efectivo", value: "cash" },
                      { label: "Tarjeta", value: "card" },
                      { label: "Transferencia", value: "transfer" },
                    ]}
                  />
                </div>
              </div>

              <Separator />

              {/* 4. FICHA MÉDICA */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    4
                  </span>
                  Ficha Médica
                </h4>
                <div className="space-y-4 pl-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormInputGroup
                      control={form.control}
                      name="weight_kg"
                      label="Peso (kg)"
                      type="number"
                      icon={<IconScale className="h-4 w-4" />}
                      placeholder="70"
                    />
                    <FormInputGroup
                      control={form.control}
                      name="height_cm"
                      label="Estatura (cm)"
                      type="number"
                      icon={<IconRuler className="h-4 w-4" />}
                      placeholder="170"
                    />
                  </div>
                  <FormSelect
                    control={form.control}
                    name="body_type"
                    label="Somatotipo"
                    placeholder="Seleccionar..."
                    options={[
                      { label: "Ectomorfo", value: "ectomorph" },
                      { label: "Mesomorfo", value: "mesomorph" },
                      { label: "Endomorfo", value: "endomorph" },
                    ]}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormSelect
                      control={form.control}
                      name="diet_type"
                      label="Tipo de dieta"
                      required
                      options={[
                        { label: "Hipocalórica", value: "hipocalorica" },
                        { label: "Normocalórica", value: "normocalorica" },
                        { label: "Hipercalórica", value: "hipercalorica" },
                      ]}
                    />
                    <FormSelect
                      control={form.control}
                      name="activity_level"
                      label="Nivel de actividad"
                      required
                      options={[
                        { label: "Poco o nada", value: "sedentario" },
                        { label: "1 a 3 días/semana", value: "1_3_dias" },
                        { label: "3 a 5 días/semana", value: "3_5_dias" },
                        { label: "6 a 7 días/semana", value: "6_7_dias" },
                        { label: "2 veces al día", value: "2_veces_dia" },
                      ]}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormInputGroup
                      control={form.control}
                      name="body_fat_percentage"
                      label="% Grasa"
                      type="number"
                      required
                    />
                    <FormInputGroup
                      control={form.control}
                      name="muscle_mass_kg"
                      label="Masa Muscular (kg)"
                      type="number"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormInputGroup control={form.control} name="chest" label="Pecho (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="waist" label="Cintura (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="hip" label="Cadera (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="arm_right" label="Brazo Der. (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="arm_left" label="Brazo Izq. (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="leg_right" label="Pierna Der. (cm)" type="number" required />
                    <FormInputGroup control={form.control} name="leg_left" label="Pierna Izq. (cm)" type="number" required />
                  </div>
                  <FormTextarea control={form.control} name="injuries" label="Observaciones / Lesiones" />
                  <FormTextarea control={form.control} name="notes" label="Notas nutrición/rutina" />
                  {calculationPreview && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <p className="font-medium mb-1">Vista previa cálculo</p>
                      <p>Calorías: {calculationPreview.dailyCalories} kcal</p>
                      <p>
                        Macros (P/C/G): {calculationPreview.proteinGrams}/{calculationPreview.carbsGrams}/
                        {calculationPreview.fatGrams} g
                      </p>
                      <p>Agua: {calculationPreview.waterLitersGoal} L</p>
                      <p>Cardio: {calculationPreview.cardioMinutes} min</p>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-background/80 backdrop-blur-md z-10 font-sans">
          <SheetClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </SheetClose>
          <Button type="submit" disabled={isPending} onClick={form.handleSubmit(onSubmit)}>
            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar Cambios" : "Registrar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

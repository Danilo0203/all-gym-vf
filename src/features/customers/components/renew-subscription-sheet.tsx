"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormSelect } from "@/components/forms/form-select";
import { FormInputGroup } from "@/components/forms/form-input-group";
import { FormTextarea } from "@/components/forms/form-textarea";
import {
  IconCalendar,
  IconDiscount,
  IconScale,
  IconRuler,
  IconCheck,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePlans } from "@/features/plans/hooks/use-plans";
import { renewSubscription } from "../actions/customer-actions";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { addDays, format, parse, isValid, differenceInDays } from "date-fns";
import { computeFitnessPlan } from "@/lib/fitness/excel-calculator";
import type { ActivityLevel, BodyType, DietType } from "@/lib/fitness/types";

function toBodyType(value?: string | null): BodyType {
  if (value === "ectomorph" || value === "mesomorph" || value === "endomorph") return value;
  return "mesomorph";
}

function toDietType(value?: string | null): DietType {
  if (value === "hipocalorica" || value === "normocalorica" || value === "hipercalorica") return value;
  return "normocalorica";
}

function toActivityLevel(value?: string | null): ActivityLevel {
  if (value === "sedentario" || value === "1_3_dias" || value === "3_5_dias" || value === "6_7_dias" || value === "2_veces_dia") {
    return value;
  }
  return "3_5_dias";
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
        <Popover>
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
              initialFocus
              locale={es}
              captionLayout="dropdown"
              startMonth={new Date(1920, 0)}
              endMonth={new Date(new Date().getFullYear() + 10, 11)}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  );
}
// TIPO DE DATOS DEL SHEET
interface RenewSubscriptionSheetProps {
  customerId: string;
  customerName: string;
  customerGender?: "male" | "female" | "other" | null;
  customerBirthDate?: string | null;
  lastAssessment?: {
    weight_kg: number;
    height_cm: number;
    body_type: string;
    diet_type?: string;
    activity_level?: string;
    body_fat_percentage?: number | null;
    muscle_mass?: number | null;
    chest_cm?: number | null;
    waist_cm?: number | null;
    injuries?: string;
    notes?: string | null;
  } | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// SCHEMA DE VALIDACIÓN
const renewSchema = z.object({
  // MEMBRESÍA
  plan_id: z.string().min(1, "Selecciona un plan"),

  // Rango de fechas como objeto, igual que en customer form
  subscription_period: z.object({
    from: z.date({ message: "La fecha de inicio es obligatoria" }),
    to: z.date({ message: "La fecha de fin es obligatoria" }),
  }),

  price: z.number(), // Precio lista del plan
  discount_amount: z.coerce.number().min(0).default(0),
  final_price: z.number(), // Precio final calculado
  payment_method: z.enum(["cash", "card", "transfer"]),

  // FICHA MÉDICA
  weight_kg: z.coerce.number().positive("El peso debe ser mayor a 0"),
  height_cm: z.coerce.number().positive("La estatura debe ser mayor a 0"),
  body_type: z.enum(["ectomorph", "mesomorph", "endomorph"]),
  diet_type: z.enum(["hipocalorica", "normocalorica", "hipercalorica"]),
  activity_level: z.enum(["sedentario", "1_3_dias", "3_5_dias", "6_7_dias", "2_veces_dia"]),
  body_fat_percentage: z.coerce.number().min(1, "Ingresa % grasa").max(100),
  muscle_mass_kg: z.coerce.number().positive("Ingresa masa muscular"),
  chest: z.coerce.number().positive("Ingresa pecho"),
  waist: z.coerce.number().positive("Ingresa cintura"),
  hip: z.coerce.number().positive("Ingresa cadera"),
  arm_right: z.coerce.number().positive("Ingresa brazo derecho"),
  arm_left: z.coerce.number().positive("Ingresa brazo izquierdo"),
  leg_right: z.coerce.number().positive("Ingresa pierna derecha"),
  leg_left: z.coerce.number().positive("Ingresa pierna izquierda"),
  injuries: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type RenewFormValues = z.infer<typeof renewSchema>;

export function RenewSubscriptionSheet({
  customerId,
  customerName,
  customerGender,
  customerBirthDate,
  lastAssessment,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: RenewSubscriptionSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? setInternalOpen) : setInternalOpen;
  const [loading, setLoading] = useState(false);

  // Estado para controlar si el usuario modificó manualmente las fechas
  const [userModifiedDates, setUserModifiedDates] = useState(false);
  const previousPlanId = useRef<string | null>(null);
  const [selectedPlanPrice, setSelectedPlanPrice] = useState<number>(0);

  // Hook de planes
  const { data: plans = [] } = usePlans(true);

  // Form
  const form = useForm<RenewFormValues>({
    resolver: zodResolver(renewSchema) as Resolver<RenewFormValues>,
    defaultValues: {
      plan_id: "",
      subscription_period: {
        from: new Date(),
        to: new Date(),
      },
      price: 0,
      discount_amount: 0,
      final_price: 0,
      payment_method: "cash",
      weight_kg: lastAssessment?.weight_kg || 0,
      height_cm: lastAssessment?.height_cm || 0,
      body_type: toBodyType(lastAssessment?.body_type),
      diet_type: toDietType(lastAssessment?.diet_type),
      activity_level: toActivityLevel(lastAssessment?.activity_level),
      body_fat_percentage: lastAssessment?.body_fat_percentage || 0,
      muscle_mass_kg: lastAssessment?.muscle_mass || 0,
      chest: lastAssessment?.chest_cm || 0,
      waist: lastAssessment?.waist_cm || 0,
      hip: 0,
      arm_right: 0,
      arm_left: 0,
      leg_right: 0,
      leg_left: 0,
      injuries: lastAssessment?.injuries || "",
      notes: lastAssessment?.notes || "",
    },
  });

  // Watchers
  const watchedPlanId = form.watch("plan_id");
  const watchedDiscount = form.watch("discount_amount");
  const watchedWeight = form.watch("weight_kg");
  const watchedHeight = form.watch("height_cm");
  const watchedBodyType = form.watch("body_type");
  const watchedDietType = form.watch("diet_type");
  const watchedActivity = form.watch("activity_level");

  const calculationPreview =
    watchedWeight &&
    watchedHeight &&
    watchedBodyType &&
    watchedDietType &&
    watchedActivity &&
    customerBirthDate &&
    customerGender
      ? computeFitnessPlan({
          birthDate: new Date(customerBirthDate),
          gender: customerGender,
          weightKg: watchedWeight,
          heightCm: watchedHeight,
          bodyType: watchedBodyType,
          dietType: watchedDietType,
          activityLevel: watchedActivity,
        })
      : null;

  // RESETEAR AL ABRIR
  useEffect(() => {
    if (open) {
      form.reset({
        plan_id: "",
        subscription_period: {
          from: new Date(),
          to: new Date(),
        },
        price: 0,
        discount_amount: 0,
        final_price: 0,
        payment_method: "cash",
        weight_kg: lastAssessment?.weight_kg || 0,
        height_cm: lastAssessment?.height_cm || 0,
        body_type: toBodyType(lastAssessment?.body_type),
        diet_type: toDietType(lastAssessment?.diet_type),
        activity_level: toActivityLevel(lastAssessment?.activity_level),
        body_fat_percentage: lastAssessment?.body_fat_percentage || 0,
        muscle_mass_kg: lastAssessment?.muscle_mass || 0,
        chest: lastAssessment?.chest_cm || 0,
        waist: lastAssessment?.waist_cm || 0,
        hip: 0,
        arm_right: 0,
        arm_left: 0,
        leg_right: 0,
        leg_left: 0,
        injuries: lastAssessment?.injuries || "",
        notes: lastAssessment?.notes || "",
      });
      setUserModifiedDates(false);
      previousPlanId.current = null;
      setSelectedPlanPrice(0);
    }
  }, [open, lastAssessment, form]);

  // Cuando cambia el plan, actualizar fechas (solo si el usuario no las modificó manualmente)
  useEffect(() => {
    if (!watchedPlanId) return;

    // Si el plan cambió (no es el mismo que antes)
    const planChanged = previousPlanId.current !== watchedPlanId;
    previousPlanId.current = watchedPlanId;

    const selectedPlan = plans.find((p) => p.id.toString() === watchedPlanId);

    if (selectedPlan) {
      // Siempre actualizar el precio base
      setSelectedPlanPrice(selectedPlan.price);
      form.setValue("price", selectedPlan.price);

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

  // Calcular Precio Final Automáticamente
  useEffect(() => {
    const discount = Number(watchedDiscount) || 0;
    const final = Math.max(0, selectedPlanPrice - discount);
    form.setValue("final_price", final);
  }, [selectedPlanPrice, watchedDiscount, form]);

  const onSubmit = async (values: RenewFormValues) => {
    try {
      setLoading(true);
      const result = await renewSubscription(customerId, {
        plan_id: Number(values.plan_id),
        start_date: values.subscription_period.from,
        end_date: values.subscription_period.to,
        price: values.price,
        discount_amount: values.discount_amount,
        amount_paid: values.final_price,
        payment_method: values.payment_method,
        weight_kg: values.weight_kg,
        height_cm: values.height_cm,
        body_type: values.body_type,
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
        injuries: values.injuries,
        notes: values.notes,
      });

      if (result.success) {
        toast.success("Suscripción renovada exitosamente");
        setOpen(false);
      } else {
        toast.error(result.error || "Error al renovar");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>
      ) : (
        <SheetTrigger asChild>
          <Button>
            <IconRefresh className="mr-2 h-4 w-4" />
            Renovar Suscripción
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="sm:max-w-xl w-full flex flex-col h-full p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b space-y-1 sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <SheetTitle>Renovar Suscripción: {customerName}</SheetTitle>
          <SheetDescription>
            Completa los detalles de la renovación y actualiza la ficha médica si es necesario.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 font-sans">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
              {/* SECCIÓN 1: MEMBRESÍA */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    1
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

              {/* SECCIÓN 2: FICHA MÉDICA */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    2
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
                    />
                    <FormInputGroup
                      control={form.control}
                      name="height_cm"
                      label="Estatura (cm)"
                      type="number"
                      icon={<IconRuler className="h-4 w-4" />}
                    />
                  </div>

                  <FormSelect
                    control={form.control}
                    name="body_type"
                    label="Somatotipo"
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

                  <FormTextarea
                    control={form.control}
                    name="injuries"
                    label="Observaciones / Lesiones"
                    placeholder="Describe cualquier lesión o condición física relevante..."
                  />
                  <FormTextarea
                    control={form.control}
                    name="notes"
                    label="Notas nutrición/rutina"
                    placeholder="Notas adicionales para cálculo y rutina..."
                  />

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

        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-background/80 backdrop-blur-md z-10">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Renovación <IconCheck className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

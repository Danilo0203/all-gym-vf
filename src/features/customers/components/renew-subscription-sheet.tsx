"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  IconNotes,
} from "@tabler/icons-react";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePlans } from "@/features/plans/hooks/use-plans";
import { renewSubscription } from "../actions/customer-actions";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { DateRange } from "react-day-picker";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { addDays, format, parse, isValid, differenceInDays } from "date-fns";
function DatePickerInput({ value, onChange }: { value?: Date; onChange: (date?: Date) => void }) {
  const [inputValue, setInputValue] = useState("");

  // Sincronizar input cuando el valor externo cambia (ej. selección en calendario)
  useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, "dd/MM/yyyy"));
    } else {
      setInputValue("");
    }
  }, [value]);

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
      <InputGroupInput value={inputValue} onChange={handleInputChange} placeholder="DD/MM/YYYY" maxLength={10} />
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
  lastAssessment?: {
    weight_kg: number;
    height_cm: number;
    body_type: string;
    injuries?: string;
  } | null;
  trigger?: React.ReactNode;
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
  weight_kg: z.coerce.number().positive("El peso debe ser mayor a 0").optional(),
  height_cm: z.coerce.number().positive("La estatura debe ser mayor a 0").optional(),
  body_type: z.enum(["ectomorph", "mesomorph", "endomorph"]).optional(),
  injuries: z.string().optional().or(z.literal("")),
});

type RenewFormValues = z.infer<typeof renewSchema>;

export function RenewSubscriptionSheet({
  customerId,
  customerName,
  lastAssessment,
  trigger,
}: RenewSubscriptionSheetProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estado para controlar si el usuario modificó manualmente las fechas
  const [userModifiedDates, setUserModifiedDates] = useState(false);
  const previousPlanId = useRef<string | null>(null);
  const [selectedPlanPrice, setSelectedPlanPrice] = useState<number>(0);

  // Hook de planes
  const { data: plans = [] } = usePlans(true);

  // Form
  const form = useForm<any>({
    resolver: zodResolver(renewSchema),
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
      body_type: (lastAssessment?.body_type as any) || "mesomorph",
      injuries: lastAssessment?.injuries || "",
    },
  });

  // Watchers
  const watchedPlanId = form.watch("plan_id");
  const watchedDiscount = form.watch("discount_amount");
  const subscriptionPeriod = form.watch("subscription_period");

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
        body_type: (lastAssessment?.body_type as any) || "mesomorph",
        injuries: lastAssessment?.injuries || "",
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
        injuries: values.injuries,
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
      <SheetTrigger asChild>
        {trigger || (
          <Button>
            <IconRefresh className="mr-2 h-4 w-4" />
            Renovar Suscripción
          </Button>
        )}
      </SheetTrigger>
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
                      control={form.control as any}
                      name="weight_kg"
                      label="Peso (kg)"
                      type="number"
                      icon={<IconScale className="h-4 w-4" />}
                    />
                    <FormInputGroup
                      control={form.control as any}
                      name="height_cm"
                      label="Estatura (cm)"
                      type="number"
                      icon={<IconRuler className="h-4 w-4" />}
                    />
                  </div>

                  <FormSelect
                    control={form.control as any}
                    name="body_type"
                    label="Somatotipo"
                    options={[
                      { label: "Ectomorfo", value: "ectomorph" },
                      { label: "Mesomorfo", value: "mesomorph" },
                      { label: "Endomorfo", value: "endomorph" },
                    ]}
                  />

                  <FormTextarea
                    control={form.control as any}
                    name="injuries"
                    label="Observaciones / Lesiones"
                    placeholder="Describe cualquier lesión o condición física relevante..."
                  />
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

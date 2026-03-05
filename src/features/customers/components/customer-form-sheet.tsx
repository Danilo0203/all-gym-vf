"use client";

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
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDays, differenceInDays, format, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";
import { CustomerData, useHookFormCustomerSheet } from "../hooks/use-hook-form-customers";
export type { CustomerData } from "../hooks/use-hook-form-customers";

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
  const {
    open,
    setOpen,
    form,
    plans,
    isEditing,
    isPending,
    selectedPlanPrice,
    subscriptionPeriod,
    calculationPreview,
    onSubmit,
    handleDateRangeChange,
    markDatesAsModified,
    reactivateCustomer,
  } = useHookFormCustomerSheet({
    mode,
    customer,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
  });

  // Trigger por defecto para modo crear
  const defaultTrigger = (
    <Button className="text-xs md:text-sm" data-testid="customers-new-button">
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
              onClick={reactivateCustomer}
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
                        markDatesAsModified();
                        form.setValue("subscription_period", {
                          from: date || new Date(),
                          to: field.value?.to || date || new Date(),
                        });
                      };

                      const handleEndChange = (date?: Date) => {
                        markDatesAsModified();
                        form.setValue("subscription_period", {
                          from: field.value?.from || new Date(),
                          to: date || new Date(),
                        });
                      };

                      // Presets for subscription periods
                      const applyPreset = (days: number) => {
                        markDatesAsModified();
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
                                    selected={
                                      subscriptionPeriod?.from
                                        ? { from: subscriptionPeriod.from, to: subscriptionPeriod.to }
                                        : undefined
                                    }
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
            <Button variant="outline" disabled={isPending} data-testid="customers-cancel-button">
              Cancelar
            </Button>
          </SheetClose>
          <Button
            type="submit"
            disabled={isPending}
            onClick={form.handleSubmit(onSubmit)}
            data-testid="customers-submit-button"
          >
            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar Cambios" : "Registrar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

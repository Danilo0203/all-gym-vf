"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as z from "zod";
import { addDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { computeFitnessPlan } from "@/lib/fitness/excel-calculator";
import type { ActivityLevel, BodyType, DietType } from "@/lib/fitness/types";
import { usePlans } from "@/features/plans/hooks/use-plans";
import { renewSubscription, type CreateCustomerData } from "../actions/customer-actions";
import { useCreateCustomer, useReactivateCustomer, useUpdateCustomer } from "./use-customers";

const profileCustomerSchema = z.object({
  full_name: z.string().min(2, {
    message: "El nombre debe tener al menos 2 caracteres.",
  }),
  phone: z.string().optional().or(z.literal("")),
  birth_date: z.date().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional(),
  emergency_contact: z.string().optional().or(z.literal("")),
  emergency_phone: z.string().optional().or(z.literal("")),
  injuries: z.string().optional().or(z.literal("")),
  medical_notes: z.string().optional().or(z.literal("")),
});

const optionalPositiveNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
}, z.number({ message: "Debe ser un número" }).positive({ message: "Debe ser mayor a 0" }).optional());

const customerSheetSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }).optional().or(z.literal("")),
  full_name: z.string().min(2, { message: "El nombre es obligatorio" }),
  birth_date: z.date({ message: "La fecha de nacimiento es obligatoria" }),
  gender: z.enum(["male", "female", "other"], { message: "Selecciona el género" }),
  phone: z.string().regex(/^\d{8}$/, { message: "El teléfono debe tener exactamente 8 dígitos" }),
  plan_id: z.string().optional(),
  final_price: z.number().optional(),
  discount_amount: z.coerce.number().min(0).default(0),
  payment_method: z.enum(["cash", "card", "transfer"]).default("cash"),
  subscription_period: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),
  weight_kg: optionalPositiveNumber,
  height_cm: optionalPositiveNumber,
  diet_type: z.enum(["hipocalorica", "normocalorica", "hipercalorica"]).optional(),
  activity_level: z.enum(["sedentario", "1_3_dias", "3_5_dias", "6_7_dias", "2_veces_dia"]).optional(),
  body_fat_percentage: z.coerce.number().min(1, { message: "Ingresa % de grasa" }).max(100).optional(),
  muscle_mass_kg: optionalPositiveNumber,
  chest: optionalPositiveNumber,
  waist: optionalPositiveNumber,
  hip: optionalPositiveNumber,
  arm_right: optionalPositiveNumber,
  arm_left: optionalPositiveNumber,
  leg_right: optionalPositiveNumber,
  leg_left: optionalPositiveNumber,
  injuries: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  body_type: z.enum(["ectomorph", "mesomorph", "endomorph"]).optional(),
});

const renewSubscriptionSchema = z.object({
  plan_id: z.string().min(1, "Selecciona un plan"),
  subscription_period: z.object({
    from: z.date({ message: "La fecha de inicio es obligatoria" }),
    to: z.date({ message: "La fecha de fin es obligatoria" }),
  }),
  price: z.number(),
  discount_amount: z.coerce.number().min(0).default(0),
  final_price: z.number(),
  payment_method: z.enum(["cash", "card", "transfer"]),
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

function parseDatabaseDate(dateString: Date | string | null | undefined): Date | undefined {
  if (!dateString) return undefined;
  if (dateString instanceof Date) return dateString;
  if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export interface ProfileFormData {
  id?: string;
  full_name: string | null;
  phone: string | null;
  birth_date?: string | null;
  gender?: "male" | "female" | "other" | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  injuries?: string | null;
  medical_notes?: string | null;
}

export type ProfileCustomerFormValues = z.infer<typeof profileCustomerSchema>;
export type CustomerSheetFormValues = z.infer<typeof customerSheetSchema>;
export type RenewSubscriptionFormValues = z.infer<typeof renewSubscriptionSchema>;

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
  plan_id?: number | null;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  discount_amount?: number | null;
  final_price?: number | null;
  payment_method?: string | null;
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

interface UseHookFormCustomerProfileParams {
  initialData: ProfileFormData | null;
}

export function useHookFormCustomerProfile({ initialData }: UseHookFormCustomerProfileParams) {
  const router = useRouter();
  const form = useForm<ProfileCustomerFormValues>({
    resolver: zodResolver(profileCustomerSchema),
    defaultValues: {
      full_name: initialData?.full_name || "",
      phone: initialData?.phone || "",
      birth_date: initialData?.birth_date ? new Date(initialData.birth_date) : undefined,
      gender: initialData?.gender || "male",
      emergency_contact: initialData?.emergency_contact || "",
      emergency_phone: initialData?.emergency_phone || "",
      injuries: initialData?.injuries || "",
      medical_notes: initialData?.medical_notes || "",
    },
  });

  const onSubmit = (values: ProfileCustomerFormValues) => {
    console.log(values);
    router.push("/panel/clientes");
  };

  return {
    form,
    onSubmit,
    onCancel: () => router.back(),
  };
}

interface UseHookFormCustomerSheetParams {
  mode?: "create" | "edit";
  customer?: CustomerData | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function useHookFormCustomerSheet({
  mode = "create",
  customer = null,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: UseHookFormCustomerSheetParams) {
  const [internalOpen, setInternalOpen] = useState(false);
  const userModifiedDatesRef = useRef(false);
  const previousPlanId = useRef<string | null>(null);
  const { data: plans = [] } = usePlans(true);
  const { mutateAsync: createCustomerMutation, isPending: isCreating } = useCreateCustomer();
  const { mutateAsync: updateCustomerMutation, isPending: isUpdating } = useUpdateCustomer();
  const { mutateAsync: reactivateCustomerMutation } = useReactivateCustomer();
  const isPending = isCreating || isUpdating;
  const isControlled = controlledOpen !== undefined;
  const requestedOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange || setInternalOpen : setInternalOpen;
  const isDataReady = mode === "create" || (mode === "edit" && !!customer);
  const open = requestedOpen && isDataReady;
  const isEditing = mode === "edit" && customer !== null;

  const getDefaultValues = useCallback((): CustomerSheetFormValues => {
    if (isEditing && customer) {
      return {
        email: customer.email || "",
        password: "",
        full_name: customer.full_name || "",
        gender: (customer.gender as "male" | "female" | "other") || "male",
        phone: customer.phone || "",
        birth_date: parseDatabaseDate(customer.birth_date) || new Date(),
        plan_id: customer.plan_id?.toString() || "",
        final_price: customer.final_price ?? undefined,
        discount_amount: customer.discount_amount ?? 0,
        payment_method: (customer.payment_method as "cash" | "card" | "transfer") || "cash",
        injuries: customer.injuries || "",
        weight_kg: customer.weight_kg ?? undefined,
        height_cm: customer.height_cm ?? undefined,
        body_type: (customer.body_type as "ectomorph" | "mesomorph" | "endomorph") || undefined,
        diet_type: (customer.diet_type as "hipocalorica" | "normocalorica" | "hipercalorica") || undefined,
        activity_level:
          (customer.activity_level as "sedentario" | "1_3_dias" | "3_5_dias" | "6_7_dias" | "2_veces_dia") ||
          undefined,
        body_fat_percentage: customer.body_fat_percentage ?? undefined,
        muscle_mass_kg: customer.muscle_mass_kg ?? undefined,
        chest: customer.chest ?? undefined,
        waist: customer.waist ?? undefined,
        hip: customer.hip ?? undefined,
        arm_right: customer.arm_right ?? undefined,
        arm_left: customer.arm_left ?? undefined,
        leg_right: customer.leg_right ?? undefined,
        leg_left: customer.leg_left ?? undefined,
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
      final_price: undefined,
      injuries: "",
      weight_kg: undefined,
      height_cm: undefined,
      diet_type: undefined,
      activity_level: undefined,
      body_fat_percentage: undefined,
      muscle_mass_kg: undefined,
      chest: undefined,
      waist: undefined,
      hip: undefined,
      arm_right: undefined,
      arm_left: undefined,
      leg_right: undefined,
      leg_left: undefined,
      body_type: undefined,
      notes: "",
      subscription_period: {
        from: new Date(),
        to: new Date(),
      },
    };
  }, [isEditing, customer]);

  const form = useForm<CustomerSheetFormValues>({
    resolver: zodResolver(customerSheetSchema) as Resolver<CustomerSheetFormValues>,
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    if (!open) return;
    const values = getDefaultValues();
    form.reset(values);
    userModifiedDatesRef.current = false;
    previousPlanId.current = customer?.plan_id?.toString() || null;
  }, [open, customer, form, getDefaultValues]);

  const watchedPlanId = useWatch({ control: form.control, name: "plan_id" });
  const watchedDiscount = useWatch({ control: form.control, name: "discount_amount" });
  const watchedWeight = useWatch({ control: form.control, name: "weight_kg" });
  const watchedHeight = useWatch({ control: form.control, name: "height_cm" });
  const watchedBodyType = useWatch({ control: form.control, name: "body_type" });
  const watchedDietType = useWatch({ control: form.control, name: "diet_type" });
  const watchedActivityLevel = useWatch({ control: form.control, name: "activity_level" });
  const watchedBirthDate = useWatch({ control: form.control, name: "birth_date" });
  const watchedGender = useWatch({ control: form.control, name: "gender" });
  const subscriptionPeriod = useWatch({ control: form.control, name: "subscription_period" });
  const selectedPlanPrice = useMemo(() => {
    const selectedPlan = plans.find((plan) => plan.id.toString() === watchedPlanId);
    return selectedPlan?.price ?? 0;
  }, [plans, watchedPlanId]);

  useEffect(() => {
    if (!watchedPlanId) return;
    const planChanged = previousPlanId.current !== watchedPlanId;
    previousPlanId.current = watchedPlanId;
    const selectedPlan = plans.find((plan) => plan.id.toString() === watchedPlanId);

    if (!selectedPlan) return;
    if (planChanged && !userModifiedDatesRef.current) {
      const startDate = form.getValues("subscription_period.from") || new Date();
      const endDate = addDays(startDate, selectedPlan.duration_days);
      form.setValue("subscription_period", {
        from: startDate,
        to: endDate,
      });
    }
  }, [watchedPlanId, plans, form]);

  useEffect(() => {
    const discount = Number(watchedDiscount) || 0;
    const finalPrice = Math.max(0, selectedPlanPrice - discount);
    form.setValue("final_price", finalPrice, { shouldValidate: false });

    if (discount > selectedPlanPrice && selectedPlanPrice > 0) {
      form.setError("discount_amount", {
        type: "manual",
        message: `El descuento no puede ser mayor al precio del plan (Q${selectedPlanPrice.toFixed(2)})`,
      });
      return;
    }

    form.clearErrors("discount_amount");
  }, [selectedPlanPrice, watchedDiscount, form]);

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

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (!range) return;
    userModifiedDatesRef.current = true;
    form.setValue("subscription_period", {
      from: range.from || new Date(),
      to: range.to || range.from || new Date(),
    });
  };

  const onSubmit = async (values: CustomerSheetFormValues) => {
    try {
      const payload: CreateCustomerData = {
        email: values.email,
        password: values.password || undefined,
        full_name: values.full_name,
        phone: values.phone,
        birth_date: values.birth_date,
        gender: values.gender,
        payment_method: values.payment_method,
        discount_amount: values.discount_amount,
        plan_id: values.plan_id ? Number(values.plan_id) : undefined,
        final_price: values.final_price,
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
  };

  const reactivateCustomer = async () => {
    if (!customer?.id) return;
    const result = await reactivateCustomerMutation(customer.id);
    if (result.success) {
      setOpen(false);
    }
  };

  return {
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
    markDatesAsModified: () => {
      userModifiedDatesRef.current = true;
    },
    reactivateCustomer,
  };
}

interface RenewAssessmentData {
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
}

interface UseHookFormRenewSubscriptionParams {
  customerId: string;
  customerGender?: "male" | "female" | "other" | null;
  customerBirthDate?: string | null;
  lastAssessment?: RenewAssessmentData | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function useHookFormRenewSubscription({
  customerId,
  customerGender,
  customerBirthDate,
  lastAssessment,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: UseHookFormRenewSubscriptionParams) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const userModifiedDatesRef = useRef(false);
  const previousPlanId = useRef<string | null>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange ?? setInternalOpen : setInternalOpen;
  const { data: plans = [] } = usePlans(true);

  const form = useForm<RenewSubscriptionFormValues>({
    resolver: zodResolver(renewSubscriptionSchema) as Resolver<RenewSubscriptionFormValues>,
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

  const watchedPlanId = useWatch({ control: form.control, name: "plan_id" });
  const watchedDiscount = useWatch({ control: form.control, name: "discount_amount" });
  const watchedWeight = useWatch({ control: form.control, name: "weight_kg" });
  const watchedHeight = useWatch({ control: form.control, name: "height_cm" });
  const watchedBodyType = useWatch({ control: form.control, name: "body_type" });
  const watchedDietType = useWatch({ control: form.control, name: "diet_type" });
  const watchedActivity = useWatch({ control: form.control, name: "activity_level" });
  const selectedPlanPrice = useMemo(() => {
    const selectedPlan = plans.find((plan) => plan.id.toString() === watchedPlanId);
    return selectedPlan?.price ?? 0;
  }, [plans, watchedPlanId]);

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

  useEffect(() => {
    if (!open) return;
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
    userModifiedDatesRef.current = false;
    previousPlanId.current = null;
  }, [open, lastAssessment, form]);

  useEffect(() => {
    if (!watchedPlanId) return;
    const planChanged = previousPlanId.current !== watchedPlanId;
    previousPlanId.current = watchedPlanId;
    const selectedPlan = plans.find((plan) => plan.id.toString() === watchedPlanId);
    if (!selectedPlan) return;

    form.setValue("price", selectedPlan.price);

    if (planChanged && !userModifiedDatesRef.current) {
      const startDate = form.getValues("subscription_period.from") || new Date();
      const endDate = addDays(startDate, selectedPlan.duration_days);
      form.setValue("subscription_period", {
        from: startDate,
        to: endDate,
      });
    }
  }, [watchedPlanId, plans, form]);

  useEffect(() => {
    const discount = Number(watchedDiscount) || 0;
    const finalPrice = Math.max(0, selectedPlanPrice - discount);
    form.setValue("final_price", finalPrice);
  }, [selectedPlanPrice, watchedDiscount, form]);

  const onSubmit = async (values: RenewSubscriptionFormValues) => {
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

  return {
    open,
    setOpen,
    form,
    plans,
    loading,
    selectedPlanPrice,
    calculationPreview,
    onSubmit,
    markDatesAsModified: () => {
      userModifiedDatesRef.current = true;
    },
  };
}

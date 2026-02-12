"use client";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormDatePicker } from "@/components/forms/form-date-picker";
import { useUpdateProfile } from "../hooks/use-profile";
import { ProfileData } from "../actions/profile-actions";
import { IconLoader2, IconDeviceFloppy } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const profileSchema = z.object({
  full_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  phone: z.string().optional().or(z.literal("")),
  birth_date: z.date().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  profile: ProfileData;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const updateProfile = useUpdateProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      birth_date: profile.birth_date ? new Date(profile.birth_date) : null,
      gender: profile.gender || undefined,
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    await updateProfile.mutateAsync({
      full_name: values.full_name,
      phone: values.phone || undefined,
      birth_date: values.birth_date ? values.birth_date.toISOString().split("T")[0] : null,
      gender: values.gender,
    });
  };

  return (
    <Card className="py-4 gap-4">
      <CardHeader className="px-4 py-0">
        <CardTitle>Información Personal</CardTitle>
        <CardDescription>Actualiza tu información personal.</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                control={form.control}
                name="full_name"
                label="Nombre Completo"
                placeholder="Tu nombre completo"
              />
              <FormInput control={form.control} name="phone" label="Teléfono" placeholder="+502 1234-5678" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormDatePicker control={form.control} name="birth_date" label="Fecha de Nacimiento" />
              <FormSelect
                control={form.control}
                name="gender"
                label="Género"
                placeholder="Selecciona género"
                options={[
                  { label: "Masculino", value: "male" },
                  { label: "Femenino", value: "female" },
                  { label: "Otro", value: "other" },
                ]}
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconDeviceFloppy className="mr-2 h-4 w-4" />
                )}
                Guardar Cambios
              </Button>
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}

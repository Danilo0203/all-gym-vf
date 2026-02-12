"use client";

import { useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { createUser, updateUser, type UserData } from "../actions/user-actions";
import { UserRole } from "@/types";

const userFormSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  full_name: z.string().min(2, { message: "El nombre es obligatorio" }),
  role: z.enum(["admin", "trainer", "employee", "client"], {
    message: "Selecciona un rol válido",
  }),
  password: z.string().optional(),
});

// Separate schemas or manual check?
// Let's use a dynamic schema or just check in onSubmit for simplicity.
const createSchema = userFormSchema.extend({
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }),
});

const editSchema = userFormSchema; // Password optional

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData | null;
}

export function UserFormSheet({ open, onOpenChange, user }: UserFormSheetProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!user;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(isEditing ? editSchema : createSchema),
    defaultValues: {
      email: "",
      full_name: "",
      role: "employee",
      password: "",
    },
  });

  // Reset form when opening/closing or changing user
  useEffect(() => {
    if (open) {
      form.reset({
        email: user?.email || "",
        full_name: user?.full_name || "",
        role: user?.role || "employee",
        password: "",
      });
    }
  }, [open, user, form]);

  const onSubmit = (values: UserFormValues) => {
    startTransition(async () => {
      try {
        if (isEditing && user) {
          const result = await updateUser({
            id: user.id,
            full_name: values.full_name,
            role: values.role as UserRole,
            password: values.password || undefined,
          });

          if (result.success) {
            toast.success("Usuario actualizado correctamente");
            onOpenChange(false);
          } else {
            toast.error(result.error || "Error al actualizar usuario");
          }
        } else {
          // Create
          if (!values.password) {
            form.setError("password", { message: "La contraseña es obligatoria" });
            return;
          }

          const result = await createUser({
            email: values.email,
            full_name: values.full_name,
            role: values.role as UserRole,
            password: values.password,
          });

          if (result.success) {
            toast.success("Usuario creado correctamente");
            onOpenChange(false);
          } else {
            toast.error(result.error || "Error al crear usuario");
          }
        }
      } catch (error) {
        toast.error("Error inesperado");
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar Usuario" : "Nuevo Usuario"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifica los datos del usuario. Deja la contraseña en blanco para mantener la actual."
              : "Crea un nuevo usuario para el sistema."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormInput control={form.control} name="full_name" label="Nombre Completo" placeholder="Juan Pérez" />

            <FormInput
              control={form.control}
              name="email"
              label="Email"
              type="email"
              placeholder="juan@gym.com"
              disabled={isEditing} // Prevent email change for now as it's the auth ID
            />

            <FormSelect
              control={form.control}
              name="role"
              label="Rol"
              options={[
                { label: "Administrador", value: "admin" },
                { label: "Entrenador", value: "trainer" },
                { label: "Empleado", value: "employee" },
                // { label: "Cliente", value: "client" }, // Clients usually created via registration or customer module
              ]}
            />

            <FormInput
              control={form.control}
              name="password"
              label={isEditing ? "Nueva Contraseña" : "Contraseña"}
              type="password"
              placeholder={isEditing ? "(Sin cambios)" : "Mínimo 6 caracteres"}
            />

            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : isEditing ? "Guardar Cambios" : "Crear Usuario"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

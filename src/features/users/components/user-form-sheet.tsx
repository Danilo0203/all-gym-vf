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
      <SheetContent className="sm:max-w-xl w-full flex flex-col h-full p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b space-y-1 sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <SheetTitle>{isEditing ? "Editar Usuario" : "Nuevo Usuario"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifica los datos del usuario. Deja la contraseña en blanco para mantener la actual."
              : "Crea un nuevo usuario para el sistema."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    1
                  </span>
                  Información Personal
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                  <FormInput control={form.control} name="full_name" label="Nombre Completo" placeholder="Juan Pérez" />
                  <FormInput
                    control={form.control}
                    name="email"
                    label="Email"
                    type="email"
                    placeholder="juan@gym.com"
                    disabled={isEditing}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                    2
                  </span>
                  Seguridad y Acceso
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                  <FormSelect
                    control={form.control}
                    name="role"
                    label="Rol"
                    options={[
                      { label: "Administrador", value: "admin" },
                      { label: "Entrenador", value: "trainer" },
                      { label: "Empleado", value: "employee" },
                    ]}
                  />
                  <FormInput
                    control={form.control}
                    name="password"
                    label={isEditing ? "Nueva Contraseña" : "Contraseña"}
                    type="password"
                    placeholder={isEditing ? "(Sin cambios)" : "Mínimo 6 caracteres"}
                  />
                </div>
              </div>
            </form>
          </Form>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-background/80 backdrop-blur-md z-10">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} onClick={form.handleSubmit(onSubmit)}>
            {isPending ? "Guardando..." : isEditing ? "Guardar Cambios" : "Crear Usuario"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

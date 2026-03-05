"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";

const formSchema = z.object({
  email: z.string().email({ message: "Introduce un correo electrónico válido" }),
  password: z.string().min(1, { message: "La contraseña es obligatoria" }),
});

export type UserAuthFormValue = z.infer<typeof formSchema>;

interface UseHookFormAuthParams {
  callbackUrl: string | null;
  onSuccessRedirect: (path: string) => void;
}

export function useHookFormAuth({ callbackUrl, onSuccessRedirect }: UseHookFormAuthParams) {
  const [loading, startTransition] = useTransition();
  const form = useForm<UserAuthFormValue>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "demo@gmail.com",
      password: "",
    },
  });

  const onSubmit = async (data: UserAuthFormValue) => {
    startTransition(async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      );

      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`¡Sesión iniciada correctamente!`);
        onSuccessRedirect(callbackUrl || "/panel");
      }
    });
  };

  return {
    form,
    loading,
    onSubmit,
  };
}


"use client";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import GithubSignInButton from "./github-auth-button";
import { FormInput } from "@/components/forms/form-input";
import { createBrowserClient } from "@supabase/ssr";

const formSchema = z.object({
  email: z.string().email({ message: "Introduce un correo electrónico válido" }),
  password: z.string().min(1, { message: "La contraseña es obligatoria" }),
});

type UserFormValue = z.infer<typeof formSchema>;

export default function UserAuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl");
  const [loading, startTransition] = useTransition();
  const defaultValues = {
    email: "demo@gmail.com",
    password: "",
  };
  const form = useForm<UserFormValue>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const onSubmit = async (data: UserFormValue) => {
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
        toast.success("¡Sesión iniciada correctamente!");
        router.push(callbackUrl || "/panel");
      }
    });
  };

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-2">
        <Form {...form}>
          <FormInput
            control={form.control}
            name="email"
            label="Correo electrónico"
            placeholder="Introduce tu correo..."
            disabled={loading}
          />
          <FormInput
            control={form.control}
            name="password"
            label="Contraseña"
            type="password"
            placeholder="Introduce tu contraseña..."
            disabled={loading}
          />
          <Button disabled={loading} className="mt-2 ml-auto w-full" type="submit">
            Iniciar sesión con correo
          </Button>
        </Form>
      </form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">O continuar con</span>
        </div>
      </div>
      <GithubSignInButton />
    </>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IconLoader2, IconBarbell, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
      );

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Código enviado a tu correo');
        router.push(`/auth/verify-code?email=${encodeURIComponent(email)}`);
      }
    } catch (error) {
      toast.error('Error al enviar el código');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-semibold text-lg">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <IconBarbell className="size-5" />
          </div>
          All Gym
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Recuperar Contraseña</CardTitle>
            <CardDescription>
              Ingresa tu email para recibir un código de verificación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </Field>
                <Field>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar Código
                  </Button>
                </Field>
                <div className="text-center text-sm">
                  <Link href="/iniciar-sesion" className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary">
                    <IconArrowLeft className="size-4" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

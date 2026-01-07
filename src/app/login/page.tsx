import { IconBarbell } from "@tabler/icons-react";
import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: 'Iniciar Sesión - All Gym',
  description: 'Accede al sistema de gestión de gimnasio'
};

export default function LoginPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-semibold text-lg">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <IconBarbell className="size-5" />
          </div>
          All Gym
        </a>
        <LoginForm />
      </div>
    </div>
  );
}

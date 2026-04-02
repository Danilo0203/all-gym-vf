import { redirect } from "next/navigation";
import { ClientShell } from "@/features/client/components/client-shell";
import { getUserAccessContext } from "@/lib/auth/authorization";
import { isClientRole } from "@/lib/auth/role-utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi espacio",
  description: "Rutina, perfil y membresía del cliente de All Gym",
};

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }

  if (!isClientRole(access.role)) {
    redirect("/panel/resumen");
  }

  return <ClientShell>{children}</ClientShell>;
}

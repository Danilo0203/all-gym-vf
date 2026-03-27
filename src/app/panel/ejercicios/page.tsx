import PageContainer from "@/components/layout/page-container";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { SeedCatalogButton } from "@/features/customers/components/seed-catalog-button";
import { getUserAccessContext } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Ejercicios y Catálogo",
};

export default async function ExercisesPage() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }

  if (!access.isAdmin) {
    redirect("/panel");
  }

  const adminClient = createAdminClient();
  const { count } = await adminClient
    .from("exercises")
    .select("*", { count: "exact", head: true });

  return (
    <PageContainer>
      <div className="flex items-start justify-between">
        <Heading title="Ejercicios" description="Gestiona el catálogo de ejercicios de ExerciseDB." />
      </div>
      <Separator className="my-4" />
      <div className="space-y-6">
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-medium">Estado del Catálogo Local</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Actualmente hay <strong>{count ?? 0}</strong> ejercicios importados en la base local.
          </p>
          <div className="mt-4">
            <SeedCatalogButton />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

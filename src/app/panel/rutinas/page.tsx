import { Suspense } from "react";
import { redirect } from "next/navigation";

import PageContainer from "@/components/layout/page-container";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import RoutinesListing from "@/features/routines/components/routines-listing";
import { getUserAccessContext } from "@/lib/auth/authorization";

export const metadata = {
  title: "Panel: Rutinas",
};

export default async function RoutinesPage() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) {
    redirect("/iniciar-sesion");
  }
  if (!access.isAdmin) {
    redirect("/panel");
  }

  return (
    <PageContainer
      scrollable
      pageTitle="Rutinas"
      pageDescription="Todas las rutinas guardadas de tus clientes."
    >
      <Suspense fallback={<DataTableSkeleton columnCount={4} rowCount={8} />}>
        <RoutinesListing />
      </Suspense>
    </PageContainer>
  );
}

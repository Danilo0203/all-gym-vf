import PageContainer from "@/components/layout/page-container";
import { getUsers } from "@/features/users/actions/user-actions";
import { UsersTable } from "@/features/users/components/users-table";
import { Suspense } from "react";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { CreateUserButton } from "@/features/users/components/create-user-button";

export const metadata = {
  title: "Dashboard: Usuarios",
};

export default async function UsersPage() {
  const { data: users, success, error } = await getUsers();

  if (!success || !users) {
    // Handle error state appropriately
    return (
      <PageContainer
        scrollable={false}
        pageTitle="Usuarios"
        pageDescription="Administración de usuarios del sistema"
        pageHeaderAction={<CreateUserButton />}
      >
        <div className="p-4 text-red-500">Error al cargar usuarios: {error}</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      scrollable={false}
      pageTitle="Usuarios"
      pageDescription="Administración de usuarios del sistema"
      pageHeaderAction={<CreateUserButton />}
    >
      <Suspense fallback={<DataTableSkeleton columnCount={4} rowCount={5} />}>
        <UsersTable data={users} />
      </Suspense>
    </PageContainer>
  );
}

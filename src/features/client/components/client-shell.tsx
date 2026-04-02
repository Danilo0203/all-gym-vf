"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCreditCard, IconUserCircle, IconBarbell } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientSignOutButton } from "@/features/client/components/client-sign-out-button";
import { useOnlineStatus } from "@/features/client/hooks/use-online-status";

const NAV_ITEMS = [
  {
    href: "/mi/rutina",
    label: "Rutina",
    icon: IconBarbell,
  },
  {
    href: "/mi/membresia",
    label: "Membresía",
    icon: IconCreditCard,
  },
  {
    href: "/mi/perfil",
    label: "Perfil",
    icon: IconUserCircle,
  },
];

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOnline = useOnlineStatus();

  return (
    <div className="h-svh overflow-y-auto overscroll-y-contain bg-muted/40 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
      <div className="mx-auto flex min-h-svh max-w-4xl flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">All Gym</p>
              <h1 className="text-lg font-black tracking-tight">Mi espacio</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
                {isOnline ? "Conectado" : "Offline"}
              </span>
              <ClientSignOutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] pt-5">{children}</main>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <Card className="pointer-events-auto mx-auto max-w-4xl border-border/70 bg-background/95 p-2 shadow-lg backdrop-blur">
            <nav className="grid grid-cols-3 gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={isActive ? "default" : "ghost"}
                    className="h-12 flex-col gap-1 rounded-xl"
                  >
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px]">{item.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </Card>
        </div>
      </div>
    </div>
  );
}

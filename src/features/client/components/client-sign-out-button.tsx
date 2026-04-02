"use client";

import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { IconLogout } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearPwaCaches } from "@/lib/pwa/client-cache";

export function ClientSignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      );

      await clearPwaCaches();
      await supabase.auth.signOut();
      router.push("/iniciar-sesion");
      router.refresh();
    } catch (error) {
      console.error("Error signing out client app:", error);
      toast.error("No fue posible cerrar la sesión.");
    }
  };

  return (
    <Button type="button" variant="ghost" size="icon" onClick={handleSignOut} aria-label="Cerrar sesión">
      <IconLogout className="h-4 w-4" />
    </Button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLogout } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearPwaCaches } from "@/lib/pwa/client-cache";
import { createClient } from "@/lib/supabase/client";

export function ClientSignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);

    try {
      const supabase = createClient();

      void clearPwaCaches().catch((cacheError) => {
        console.warn("No fue posible limpiar los caches PWA durante el logout:", cacheError);
      });

      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        throw error;
      }

      router.replace("/iniciar-sesion");
      router.refresh();
    } catch (error) {
      console.error("Error signing out client app:", error);
      toast.error("No fue posible cerrar la sesión.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleSignOut}
      disabled={isSigningOut}
      aria-label="Cerrar sesión"
    >
      <IconLogout className="h-4 w-4" />
    </Button>
  );
}

import { createClient } from "@/lib/supabase/server";
import { getDefaultRouteForRole, parseUserRole } from "@/lib/auth/role-utils";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/iniciar-sesion");
  } else {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const role = parseUserRole(profile?.role) ?? parseUserRole(user.user_metadata?.role);
    redirect(getDefaultRouteForRole(role));
  }
}

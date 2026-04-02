import { createClient } from '@/lib/supabase/server';
import { OAUTH_LOGIN_ENABLED } from "@/lib/auth/feature-flags";
import { getDefaultRouteForRole, parseUserRole } from "@/lib/auth/role-utils";
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (!OAUTH_LOGIN_ENABLED) {
    return NextResponse.redirect(`${origin}/iniciar-sesion?error=oauth_disabled`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        : { data: null };
      const role = parseUserRole(profile?.role) ?? parseUserRole(user?.user_metadata?.role);

      return NextResponse.redirect(`${origin}${next ?? getDefaultRouteForRole(role)}`);
    }
  }

  // Return to login page with error
  return NextResponse.redirect(`${origin}/iniciar-sesion?error=auth_failed`);
}

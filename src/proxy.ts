import { createServerClient } from "@supabase/ssr";
import { isClientScope } from "@/lib/auth/role-utils";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (request.nextUrl.pathname.startsWith("/panel")) {
      console.warn("Supabase environment variables are missing! Authentication will not work.");
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedArea = pathname.startsWith("/panel") || pathname.startsWith("/mi");

  if (!user && isProtectedArea) {
    const url = request.nextUrl.clone();
    url.pathname = "/iniciar-sesion";
    return NextResponse.redirect(url);
  }

  if (!user) {
    return response;
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const roleSlug = (profile?.role || user.user_metadata?.role || null) as string | null;

  // Fetch role scope from DB
  let scope: string | null = null;
  if (roleSlug) {
    const { data: roleData } = await supabase
      .from("roles")
      .select("scope")
      .eq("slug", roleSlug)
      .maybeSingle();
    scope = roleData?.scope || null;
  }

  const defaultRoute = isClientScope(scope) ? "/mi/rutina" : "/panel/resumen";

  if (pathname.startsWith("/iniciar-sesion")) {
    const url = request.nextUrl.clone();
    url.pathname = defaultRoute;
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = defaultRoute;
    return NextResponse.redirect(url);
  }

  // Gate by scope: clients → /mi, panel users → /panel
  if (pathname.startsWith("/panel") && isClientScope(scope)) {
    const url = request.nextUrl.clone();
    url.pathname = "/mi/rutina";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/mi") && !isClientScope(scope)) {
    const url = request.nextUrl.clone();
    url.pathname = "/panel/resumen";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Check for required Supabase environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (request.nextUrl.pathname.startsWith("/panel")) {
      // If we are trying to access dashboard without env vars, warn but maybe allow render
      // logic to handle it or redirect to a special setup page.
      // For now, let's just return response to avoid crash, but auth will fail.
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

  if (!user && request.nextUrl.pathname.startsWith("/panel")) {
    const url = request.nextUrl.clone();
    url.pathname = "/iniciar-sesion";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith("/iniciar-sesion")) {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    return NextResponse.redirect(url);
  }

  // Protect Admin-Only Routes
  const adminOnlyRoutes = ["/panel/usuarios", "/panel/planes", "/panel/pagos", "/panel/ejercicios"];
  const isAdminRoute = adminOnlyRoutes.some((route) => request.nextUrl.pathname.startsWith(route));

  if (user && isAdminRoute) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const role = profile?.role ?? user.user_metadata?.role;

    // Only admin role can access these routes
    if (role !== "admin") {
      // Redirect to panel root
      const url = request.nextUrl.clone();
      url.pathname = "/panel";
      return NextResponse.redirect(url);
    }
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

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const cookieNames = request.cookies
    .getAll()
    .map(({ name }) => name)
    .filter((name, index, names) => names.indexOf(name) === index)
    .filter((name) => name.startsWith("sb-") || name.includes("supabase") || name.includes("auth"));

  console.log("[middleware] request", {
    pathname,
    cookieNames,
  });

  if (publicRoutes.includes(pathname)) {
    console.log("[middleware] redirected", {
      pathname,
      redirected: false,
      reason: "public-route",
    });
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data,
    error,
  } = await supabase.auth.getUser();

  console.log("[middleware] getUser result", {
    pathname,
    hasUser: Boolean(data.user),
    userId: data.user?.id ?? null,
    error: error?.message ?? null,
  });

  const {
    data: { user },
  } = { data };

  if (!user && pathname !== "/") {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    console.log("[middleware] redirected", {
      pathname,
      redirected: true,
      to: redirectUrl.pathname,
      next: pathname,
    });
    return NextResponse.redirect(redirectUrl);
  }

  console.log("[middleware] redirected", {
    pathname,
    redirected: false,
    reason: "authenticated-or-root",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
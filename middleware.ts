import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password"]; 

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  console.log("[middleware] request", { pathname });

  if (publicRoutes.includes(pathname)) {
    console.log("[middleware] public route allowed", { pathname });
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  console.log("[middleware] before getUser", { pathname });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  console.log("[middleware] after getUser", {
    pathname,
    hasUser: Boolean(user),
    userId: user?.id ?? null,
    error: error?.message ?? null,
  });

  if (!user && pathname !== "/") {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    console.log("[middleware] redirect to login", {
      from: pathname,
      to: redirectUrl.pathname,
      next: pathname,
    });
    return NextResponse.redirect(redirectUrl);
  }

  console.log("[middleware] allowing request", { pathname, hasUser: Boolean(user) });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

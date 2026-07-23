import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type Database = Record<string, unknown>;

export async function createSupabaseServerClient<DatabaseShape = Database>() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const cookieStore = await cookies();

  return createServerClient<DatabaseShape>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies; middleware handles refresh persistence.
        }
      },
    },
  });
}
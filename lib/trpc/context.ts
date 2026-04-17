import { createServerClient } from "@supabase/ssr";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

function parseCookies(cookieHeader: string) {
  if (!cookieHeader) return [];
  return cookieHeader.split(";").map((c) => {
    const [name, ...rest] = c.trim().split("=");
    return { name: name.trim(), value: rest.join("=").trim() };
  });
}

export async function createContext({ req }: FetchCreateContextFnOptions) {
  const cookieHeader = req.headers.get("cookie") ?? "";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookies(cookieHeader);
        },
        setAll() {
          // No-op — can't set cookies from tRPC handler
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return { supabase, user, profile };
}

export type Profile = {
  id: string;
  workspace_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  role: "ADMIN" | "MEMBER";
  created_at: string;
};

export type Context = Awaited<ReturnType<typeof createContext>>;

import { createClient } from "@supabase/supabase-js";

export function createAuthenticatedSupabaseClient(authHeader: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public env vars are missing");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAuthenticatedUser(
  authHeader: string | null
) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const authClient = createAuthenticatedSupabaseClient(authHeader);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return {
    authClient,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

export async function requireAdminUser(authHeader: string | null) {
  const context = await requireAuthenticatedUser(authHeader);

  const { data: roleRow, error } = await context.authClient
    .from("user_roles")
    .select("role")
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error || roleRow?.role !== "admin") {
    throw new Error("Forbidden");
  }

  return context;
}

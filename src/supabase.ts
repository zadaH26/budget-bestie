import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const USER_STATE_TABLE = import.meta.env.VITE_SUPABASE_STATE_TABLE || "user_states";
const CLOUD_SYNC_FLAG = (import.meta.env.VITE_ENABLE_CLOUD_SYNC || "").trim().toLowerCase() === "true";

export const isSupabaseConfigured = CLOUD_SYNC_FLAG && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export type CloudUser = {
  id: string;
  email: string | null;
};

function normalizeCloudPassword(password: string): string {
  // Keep short legacy-style passwords working in cloud mode while satisfying provider minimum length.
  return password.length < 6 ? `${password}__bb_cloud__` : password;
}

export async function getCloudUser(): Promise<CloudUser | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function signInCloud(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signInWithPassword({ email, password: normalizeCloudPassword(password) });
  if (error) throw error;
}

export async function signUpCloud(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signUp({ email, password: normalizeCloudPassword(password) });
  if (error) throw error;
}

export async function signOutCloud(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function loadCloudStateJson(userId: string): Promise<unknown | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(USER_STATE_TABLE)
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.state ?? null;
}

export async function saveCloudStateJson(userId: string, state: unknown): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(USER_STATE_TABLE).upsert(
    {
      user_id: userId,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}

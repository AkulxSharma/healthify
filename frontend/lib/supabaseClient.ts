import { createClient } from "@supabase/supabase-js";
import type { AuthResponse } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase anon key present:", !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be set in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const signUpWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
  return supabase.auth.signUp({ email, password });
};

export const signInWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
  await supabase.auth.signOut();
  const response = await supabase.auth.signInWithPassword({ email, password });
  if (response.error) {
    return response;
  }
  const returnedEmail = response.data?.user?.email;
  if (!returnedEmail || returnedEmail.toLowerCase() !== email.toLowerCase()) {
    await supabase.auth.signOut();
    throw new Error("Credentials did not match the requested account.");
  }
  return response;
};

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};

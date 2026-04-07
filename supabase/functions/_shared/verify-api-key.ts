import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Verify API key against system_settings table, with env fallback.
 * Returns true if the key is valid.
 */
export async function verifyApiKey(apiKey: string | null): Promise<boolean> {
  if (!apiKey) return false;

  // Try DB first
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key_name", "api_integration_key")
      .single();

    if (data?.value && data.value === apiKey) return true;
  } catch {
    // DB lookup failed, fall through to env
  }

  // Fallback to env var
  const envKey = Deno.env.get("API_INTEGRATION_KEY");
  return !!envKey && apiKey === envKey;
}

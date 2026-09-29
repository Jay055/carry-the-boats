import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xzgxqylefceimcciwzmm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_s1fU2cHSQGQ6zagD-aA00w_CS0_3lP9";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

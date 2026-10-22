
import { createClient } from "@supabase/supabase-js";

const url = "https://nzfxnntdnskccxswzqdj.supabase.co";
const anonKey = "sb_publishable_XUeSwXQ5hLNkwKO1O9GI-A_qrNNw-Vv";

export const supabaseReady = Boolean(url && anonKey);

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

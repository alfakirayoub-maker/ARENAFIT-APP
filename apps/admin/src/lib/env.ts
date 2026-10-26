/** Public configuration (inlined in the browser bundle — never secrets). */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

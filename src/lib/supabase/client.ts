import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../types/database';

export function createClient() {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { AstroCookieSetOptions, AstroCookies } from 'astro';
import type { Database } from '../../types/database';

export function createSupabaseServerClient(context: {
  request: Request;
  cookies: AstroCookies;
}) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(context.request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, options as AstroCookieSetOptions);
        });
      },
    },
  });
}

export function createSupabaseAdminClient() {
  const supabaseUrl = (import.meta.env as any).PUBLIC_SUPABASE_URL || '';
  const serviceKey = (import.meta.env as any).SUPABASE_SERVICE_ROLE_KEY || '';

  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

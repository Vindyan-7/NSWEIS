import { createServerClient, parseCookieHeader } from '@supabase/ssr';
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

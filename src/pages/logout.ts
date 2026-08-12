import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../lib/supabase/server';

export const GET: APIRoute = async (context) => {
  const supabase = createSupabaseServerClient(context as any);
  await supabase.auth.signOut();
  return context.redirect('/login');
};

export const POST: APIRoute = async (context) => {
  const supabase = createSupabaseServerClient(context as any);
  await supabase.auth.signOut();
  return context.redirect('/login');
};

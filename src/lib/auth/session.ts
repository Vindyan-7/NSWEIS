import type { AstroCookies } from 'astro';
import { createSupabaseServerClient } from '../supabase/server';
import type { UserProfile } from '../../types/domain';

export interface AuthSession {
  user: {
    id: string;
    email?: string;
  } | null;
  profile: UserProfile | null;
}

export async function getAuthSession(context: {
  request: Request;
  cookies: AstroCookies;
}): Promise<AuthSession> {
  const supabase = createSupabaseServerClient(context);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile as UserProfile | null,
  };
}

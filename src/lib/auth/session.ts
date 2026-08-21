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

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const email = user.email || '';
    const inferredRole = email.includes('super')
      ? 'super_admin'
      : email.includes('admin')
      ? 'government_admin'
      : email.includes('college')
      ? 'college_officer'
      : 'student';

    profile = {
      id: user.id,
      full_name: user.user_metadata?.full_name || email.split('@')[0] || 'Student',
      role: inferredRole,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile as UserProfile | null,
  };
}

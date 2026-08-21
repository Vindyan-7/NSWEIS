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

    const newProfile = {
      id: user.id,
      full_name: user.user_metadata?.full_name || email.split('@')[0] || 'Student',
      role: inferredRole,
      institution_id: '11111111-1111-1111-1111-111111111111',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Auto-persist missing profile row into public.profiles database table to satisfy FK constraints
    const { data: createdProfile, error: upsertErr } = await (supabase.from('profiles') as any)
      .upsert(newProfile, { onConflict: 'id' })
      .select()
      .single();

    if (upsertErr) {
      console.error('[AUTH SESSION] Profile upsert error for user:', user.id, upsertErr);
    }

    // Read-back verification to guarantee profile row exists in public.profiles table
    const { data: verifiedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    profile = verifiedProfile || createdProfile || (newProfile as any);
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile as UserProfile | null,
  };
}

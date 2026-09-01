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

  // SECURITY (AUDIT.md C1b): a role is NEVER derived from the user's own email
  // address, and a session NEVER provisions its own profile row.
  //
  // The previous implementation inferred super_admin from email.includes('super'),
  // which made privilege escalation a matter of choosing an address. Roles are
  // assigned downward through the hierarchy only:
  //     super_admin -> government_admin -> college_officer -> student
  // and clinicians are provisioned by a government_admin.
  //
  // A signed-in user with no profile row has no role. Middleware sends them to
  // /no-access rather than guessing what they are allowed to see.
  if (!profile) {
    console.warn('[AUTH] Signed-in user has no profile row; denying role:', user.id);
    return { user: { id: user.id, email: user.email }, profile: null };
  }

  const resolvedProfile = { ...(profile as any) } as UserProfile;

  // DB enum fallback compatibility for regional_officer / clinician when DB enum is government_admin
  const metaRole = user.user_metadata?.role;
  if (metaRole && (metaRole === 'regional_officer' || metaRole === 'clinician')) {
    resolvedProfile.role = metaRole;
  }

  if (user.user_metadata?.region_id && !resolvedProfile.region_id) {
    resolvedProfile.region_id = user.user_metadata.region_id;
  }
  if (user.user_metadata?.institution_id && !resolvedProfile.institution_id) {
    resolvedProfile.institution_id = user.user_metadata.institution_id;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: resolvedProfile,
  };
}


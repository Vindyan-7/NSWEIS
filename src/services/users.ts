import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { UserProfile } from '../types/domain';

export async function getUserProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  const profile = { ...(data as any) } as UserProfile;

  if (supabase.auth?.admin?.getUserById) {
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      // DB enum fallback compatibility for regional_officer / clinician ONLY when profile.role is government_admin
      if (profile.role === ('government_admin' as any) && authUser?.user?.user_metadata?.role === 'regional_officer') {
        profile.role = 'regional_officer';
      }
      if (profile.role === ('government_admin' as any) && authUser?.user?.user_metadata?.role === 'clinician') {
        profile.role = 'clinician';
      }
      if (authUser?.user?.user_metadata?.region_id && !profile.region_id) {
        profile.region_id = authUser.user.user_metadata.region_id;
      }
      if (authUser?.user?.user_metadata?.institution_id && !profile.institution_id) {
        profile.institution_id = authUser.user.user_metadata.institution_id;
      }
    } catch {
      // ignore
    }
  }

  return profile;
}

export { getUserProfile as getProfile };

export async function updateUserProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from('profiles' as any) as any)
    .update(updates)
    .eq('id', userId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

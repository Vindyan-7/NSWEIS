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
  return data as UserProfile;
}

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

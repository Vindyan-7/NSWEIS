import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { Intervention } from '../types/domain';

export async function getInstitutionInterventions(
  supabase: SupabaseClient<Database>,
  institutionId: string
): Promise<Intervention[]> {
  const { data, error } = await supabase
    .from('interventions')
    .select('*')
    .eq('institution_id', institutionId)
    .order('scheduled_at', { ascending: false });

  if (error || !data) return [];
  return data as Intervention[];
}

export async function createIntervention(
  supabase: SupabaseClient<Database>,
  interventionData: Omit<Intervention, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; data?: Intervention; error?: string }> {
  const { data, error } = await supabase
    .from('interventions')
    .insert({
      ...interventionData,
      status: interventionData.status || 'scheduled',
    } as any)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to create intervention' };
  }

  return { success: true, data: data as Intervention };
}

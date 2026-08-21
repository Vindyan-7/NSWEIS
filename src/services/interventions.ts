import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { Intervention, InterventionStatus, WellnessCategory } from '../types/domain';

export interface CreateInterventionInput {
  institution_id: string;
  created_by: string;
  title: string;
  description: string;
  category: WellnessCategory;
  target_department_id?: string | null;
  target_year?: number | null;
  scheduled_at: string;
  location: string;
  capacity?: number | null;
  status?: InterventionStatus;
}

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

export async function getInterventionById(
  supabase: SupabaseClient<Database>,
  interventionId: string,
  institutionId: string
): Promise<Intervention | null> {
  const { data, error } = await supabase
    .from('interventions')
    .select('*')
    .eq('id', interventionId)
    .eq('institution_id', institutionId)
    .single();

  if (error || !data) return null;
  return data as Intervention;
}

export async function createIntervention(
  supabase: SupabaseClient<Database>,
  input: CreateInterventionInput
): Promise<{ success: boolean; data?: Intervention; error?: string }> {
  const { data, error } = await (supabase.from('interventions' as any) as any)
    .insert([
      {
        institution_id: input.institution_id,
        created_by: input.created_by,
        title: input.title,
        description: input.description,
        category: input.category,
        target_department_id: input.target_department_id || null,
        target_year: input.target_year || null,
        scheduled_at: input.scheduled_at,
        location: input.location,
        capacity: input.capacity || null,
        status: input.status || 'scheduled',
      },
    ])
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to create intervention' };
  }

  return { success: true, data: data as Intervention };
}

export async function updateInterventionStatus(
  supabase: SupabaseClient<Database>,
  interventionId: string,
  institutionId: string,
  newStatus: InterventionStatus
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from('interventions' as any) as any)
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', interventionId)
    .eq('institution_id', institutionId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

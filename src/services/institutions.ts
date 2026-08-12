import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { Institution, Department } from '../types/domain';

export async function getInstitutions(
  supabase: SupabaseClient<Database>
): Promise<Institution[]> {
  const { data, error } = await supabase
    .from('institutions')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error || !data) return [];
  return data as Institution[];
}

export async function getDepartmentsByInstitution(
  supabase: SupabaseClient<Database>,
  institutionId: string
): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('institution_id', institutionId)
    .eq('active', true)
    .order('name');

  if (error || !data) return [];
  return data as Department[];
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { Institution } from '../types/domain';

export interface CreateInstitutionInput {
  name: string;
  code: string;
  state?: string;
  district?: string;
  type?: 'university' | 'college' | 'autonomous' | 'polytechnic';
  active?: boolean;
}

export async function getAuthorizedInstitutions(
  supabase: SupabaseClient<Database>,
  adminId: string
): Promise<Institution[]> {
  const { data, error } = await (supabase as any).rpc('get_government_authorized_institutions', {
    p_admin_id: adminId,
  });

  if (!error && data && data.length > 0) {
    return data.map((r: any) => ({
      id: r.institution_id || r.id,
      name: r.institution_name || r.name,
      code: r.institution_code || r.code,
      state: r.state || 'National',
      active: true,
    })) as Institution[];
  }

  // Fallback query from government_admin_scopes / institutions table
  const { data: scopes } = await (supabase as any)
    .from('government_admin_scopes')
    .select('institution_id')
    .eq('admin_profile_id', adminId);

  const instIds = (scopes || []).map((s: any) => s.institution_id);

  if (instIds.length > 0) {
    const { data: insts } = await supabase
      .from('institutions')
      .select('*')
      .in('id', instIds)
      .eq('active', true);
    return (insts || []) as Institution[];
  }

  // If super admin or fallback, fetch all active institutions
  const { data: allInsts } = await supabase
    .from('institutions')
    .select('*')
    .eq('active', true);

  return (allInsts || []) as Institution[];
}

export async function getAllInstitutions(
  supabase: SupabaseClient<Database>
): Promise<Institution[]> {
  const { data, error } = await supabase
    .from('institutions')
    .select('*')
    .order('name', { ascending: true });

  if (error || !data) return [];
  return data as Institution[];
}

export async function getInstitutionById(
  supabase: SupabaseClient<Database>,
  institutionId: string
): Promise<Institution | null> {
  const { data, error } = await supabase
    .from('institutions')
    .select('*')
    .eq('id', institutionId)
    .single();

  if (error || !data) return null;
  return data as Institution;
}

export async function createInstitution(
  supabase: SupabaseClient<Database>,
  input: CreateInstitutionInput
): Promise<{ success: boolean; data?: Institution; error?: string }> {
  const { data, error } = await (supabase.from('institutions' as any) as any)
    .insert([
      {
        name: input.name,
        code: input.code,
        state: input.state || 'National',
        district: input.district || null,
        type: input.type || 'college',
        active: input.active !== undefined ? input.active : true,
      },
    ])
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to create institution' };
  }

  return { success: true, data: data as Institution };
}

export async function updateInstitutionStatus(
  supabase: SupabaseClient<Database>,
  institutionId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from('institutions' as any) as any)
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', institutionId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

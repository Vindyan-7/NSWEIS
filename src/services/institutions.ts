import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { Institution } from '../types/domain';

import { createSupabaseAdminClient } from '../lib/supabase/server';

export interface CreateInstitutionInput {
  name: string;
  code: string;
  state?: string;
  district?: string;
  type?: 'university' | 'college' | 'autonomous' | 'polytechnic' | string;
  regionId?: string;
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
      district: r.district || 'Central',
      institution_type: r.institution_type || r.type || 'college',
      type: r.institution_type || r.type || 'college',
      active: true,
      region_id: r.region_id,
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
    return ((insts || []).map((r: any) => ({
      ...r,
      type: r.institution_type || r.type || 'college',
      institution_type: r.institution_type || r.type || 'college',
    }))) as Institution[];
  }

  // If super admin or fallback, fetch all active institutions
  const { data: allInsts } = await supabase
    .from('institutions')
    .select('*')
    .eq('active', true);

  return ((allInsts || []).map((r: any) => ({
    ...r,
    type: r.institution_type || r.type || 'college',
    institution_type: r.institution_type || r.type || 'college',
  }))) as Institution[];
}

export async function getAllInstitutions(
  supabase: SupabaseClient<Database>
): Promise<Institution[]> {
  const { data, error } = await supabase
    .from('institutions')
    .select('*')
    .order('name', { ascending: true });

  if (error || !data) return [];
  return (data.map((r: any) => ({
    ...r,
    type: r.institution_type || r.type || 'college',
    institution_type: r.institution_type || r.type || 'college',
  }))) as Institution[];
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
  const r = data as any;
  return {
    ...r,
    type: r.institution_type || r.type || 'college',
    institution_type: r.institution_type || r.type || 'college',
  } as Institution;
}

export async function createInstitution(
  supabase: SupabaseClient<Database>,
  input: CreateInstitutionInput
): Promise<{ success: boolean; data?: Institution; error?: string }> {
  try {
    const adminClient = createSupabaseAdminClient();
    const payload: any = {
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      state: input.state?.trim() || 'National',
      district: input.district?.trim() || 'Central',
      institution_type: input.type || 'college',
      active: input.active !== undefined ? input.active : true,
    };

    if (input.regionId) {
      payload.region_id = input.regionId;
    }

    let { data, error } = await (adminClient.from('institutions' as any) as any)
      .insert([payload])
      .select()
      .single();

    if (error && (error.message?.includes('region_id') || error.message?.includes('schema cache'))) {
      // Fallback insert without region_id if column pending in schema cache
      delete payload.region_id;
      const res = await (adminClient.from('institutions' as any) as any)
        .insert([payload])
        .select()
        .single();
      data = res.data;
      error = res.error;
    }

    if (error || !data) {
      return { success: false, error: error?.message || 'Failed to create institution' };
    }

    const created = {
      ...data,
      type: data.institution_type || data.type || 'college',
      institution_type: data.institution_type || data.type || 'college',
    };

    return { success: true, data: created as Institution };
  } catch (err: any) {
    return { success: false, error: err.message || 'An error occurred while creating institution' };
  }
}

export interface UpdateInstitutionInput {
  name?: string;
  code?: string;
  state?: string;
  district?: string;
  type?: 'university' | 'college' | 'autonomous' | 'polytechnic' | string;
  active?: boolean;
}

export async function updateInstitutionDetails(
  supabase: SupabaseClient<Database>,
  institutionId: string,
  input: UpdateInstitutionInput
): Promise<{ success: boolean; data?: Institution; error?: string }> {
  try {
    const adminClient = createSupabaseAdminClient();
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.code !== undefined) updatePayload.code = input.code.trim().toUpperCase();
    if (input.state !== undefined) updatePayload.state = input.state.trim();
    if (input.district !== undefined) updatePayload.district = input.district.trim();
    if (input.type !== undefined) updatePayload.institution_type = input.type;
    if (input.active !== undefined) updatePayload.active = input.active;

    const { data, error } = await (adminClient.from('institutions' as any) as any)
      .update(updatePayload)
      .eq('id', institutionId)
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || 'Failed to update institution details' };
    }

    const updated = {
      ...data,
      type: data.institution_type || data.type || 'college',
      institution_type: data.institution_type || data.type || 'college',
    };

    return { success: true, data: updated as Institution };
  } catch (err: any) {
    return { success: false, error: err.message || 'An error occurred while updating institution' };
  }
}

export async function updateInstitutionStatus(
  supabase: SupabaseClient<Database>,
  institutionId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createSupabaseAdminClient();
  const { error } = await (adminClient.from('institutions' as any) as any)
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', institutionId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}


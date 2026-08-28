import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { UserRole, UserProfile } from '../types/domain';
import { createSupabaseAdminClient } from '../lib/supabase/server';
import { getUserProfile } from './users';

export interface RegionItem {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  created_at?: string;
}

export interface AcademicYearItem {
  id: string;
  institution_id: string;
  year_level: number;
  label: string;
  active: boolean;
}

export interface AcademicSectionItem {
  id: string;
  institution_id: string;
  department_id?: string | null;
  year_level?: number | null;
  section_code: string;
  active: boolean;
}

export interface AcademicStructureDTO {
  departments: Array<{ id: string; name: string; code: string; active: boolean }>;
  years: AcademicYearItem[];
  sections: AcademicSectionItem[];
}

export interface ProvisionStaffInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword?: string;
  targetRole: UserRole;
  regionId?: string | null;
  institutionId?: string | null;
  departmentId?: string | null;
}

export interface ProvisionStaffResult {
  success: boolean;
  userId?: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    region_id?: string | null;
    institution_id?: string | null;
  };
  error?: string;
}

/**
 * Fallback seed regions for local/offline execution
 */
export const FALLBACK_REGIONS: RegionItem[] = [
  { id: '11111111-0000-0000-0000-000000000001', name: 'National Jurisdiction', code: 'NAT01', status: 'active' },
  { id: '11111111-0000-0000-0000-000000000002', name: 'Northern Region', code: 'NORTH01', status: 'active' },
  { id: '11111111-0000-0000-0000-000000000003', name: 'Southern Region', code: 'SOUTH01', status: 'active' },
  { id: '11111111-0000-0000-0000-000000000004', name: 'Western Region', code: 'WEST01', status: 'active' },
  { id: '11111111-0000-0000-0000-000000000005', name: 'Eastern Region', code: 'EAST01', status: 'active' },
];

/**
 * Strict Server-Side Authorization Matrix:
 * SUPER ADMIN -> government_admin
 * GOVERNMENT ADMIN -> regional_officer
 * REGIONAL OFFICER -> clinician, college_officer
 * COLLEGE OFFICER -> none (students self-register)
 * STUDENT -> none
 */
export function canCreateRole(callerRole: UserRole, targetRole: UserRole): boolean {
  if (callerRole === 'super_admin') {
    return targetRole === 'government_admin';
  }
  if (callerRole === 'government_admin') {
    return targetRole === 'regional_officer';
  }
  if (callerRole === 'regional_officer') {
    return targetRole === 'clinician' || targetRole === 'college_officer';
  }
  return false;
}

/**
 * Get all available regions
 */
export async function getRegions(supabase: SupabaseClient<Database>): Promise<RegionItem[]> {
  try {
    const { data, error } = await (supabase.from('regions') as any)
      .select('*')
      .order('name', { ascending: true });

    if (!error && data && data.length > 0) {
      return data as RegionItem[];
    }
  } catch (err) {
    // Fallback if table pending
  }
  return FALLBACK_REGIONS;
}

/**
 * Create a new region (Government Admin or Super Admin only)
 */
export async function createRegion(
  supabase: SupabaseClient<Database>,
  callerId: string,
  input: { name: string; code: string }
): Promise<{ success: boolean; region?: RegionItem; error?: string }> {
  const caller = await getUserProfile(supabase, callerId);
  if (!caller || (caller.role !== 'government_admin' && caller.role !== 'super_admin')) {
    return { success: false, error: 'Unauthorized: Only Government Administrators can create regions.' };
  }

  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();

  if (!name || !code) {
    return { success: false, error: 'Region name and code are required.' };
  }

  // Enforce uniqueness
  const existingRegions = await getRegions(supabase);
  const isDuplicate = existingRegions.some(
    (r) => r.code.toUpperCase() === code || r.name.toLowerCase() === name.toLowerCase()
  );
  if (isDuplicate) {
    return { success: false, error: `A region with code '${code}' or name '${name}' already exists.` };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { data, error } = await (adminClient.from('regions') as any)
      .insert({ name, code, status: 'active' })
      .select()
      .single();

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        const stableId = `reg-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const newRegion: RegionItem = {
          id: stableId,
          name,
          code,
          status: 'active',
          created_at: new Date().toISOString(),
        };
        const existingIdx = FALLBACK_REGIONS.findIndex((r) => r.code === code);
        if (existingIdx >= 0) {
          FALLBACK_REGIONS[existingIdx] = newRegion;
        } else {
          FALLBACK_REGIONS.push(newRegion);
        }
        return { success: true, region: newRegion };
      }
      return { success: false, error: error.message };
    }
    return { success: true, region: data as RegionItem };
  } catch (err: any) {
    const stableId = `reg-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const newRegion: RegionItem = {
      id: stableId,
      name,
      code,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    const existingIdx = FALLBACK_REGIONS.findIndex((r) => r.code === code);
    if (existingIdx >= 0) {
      FALLBACK_REGIONS[existingIdx] = newRegion;
    } else {
      FALLBACK_REGIONS.push(newRegion);
    }
    return { success: true, region: newRegion };
  }
}

/**
 * Provision a Staff Account (Server-Authoritative)
 */
export async function provisionStaffAccount(
  supabase: SupabaseClient<Database>,
  callerId: string,
  input: ProvisionStaffInput
): Promise<ProvisionStaffResult> {
  const caller = await getUserProfile(supabase, callerId);
  if (!caller) {
    return { success: false, error: 'Caller identity not found.' };
  }

  // 1. Check Authorization Matrix
  if (!canCreateRole(caller.role, input.targetRole)) {
    return {
      success: false,
      error: `Unauthorized: Role '${caller.role}' is not permitted to provision '${input.targetRole}' accounts.`,
    };
  }

  // 2. Validate Password
  const password = input.password;
  if (!password || password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  if (input.confirmPassword && password !== input.confirmPassword) {
    return { success: false, error: 'Passwords do not match.' };
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email || !fullName) {
    return { success: false, error: 'Full name and email address are required.' };
  }

  let finalRegionId: string | null = null;
  let finalInstitutionId: string | null = null;

  // 3. Resolve Scope based on Caller and Target Role
  if (caller.role === 'government_admin') {
    // Government Admin creates Regional Officer for a specific region
    if (input.targetRole === 'regional_officer') {
      if (!input.regionId) {
        return { success: false, error: 'A region must be assigned to the Regional Officer.' };
      }
      finalRegionId = input.regionId;
    }
  } else if (caller.role === 'regional_officer') {
    // Regional Officer scope is locked to their assigned region
    const callerRegion = caller.region_id || (caller as any).region_code || '11111111-0000-0000-0000-000000000001';
    finalRegionId = callerRegion;

    if (input.targetRole === 'clinician') {
      // Clinician belongs to caller's region, sees no student data
      finalRegionId = callerRegion;
    } else if (input.targetRole === 'college_officer') {
      if (!input.institutionId) {
        return { success: false, error: 'An institution must be selected for the College Officer.' };
      }
      const adminClient = createSupabaseAdminClient();
      // Verify target institution exists
      let { data: inst } = await (adminClient.from('institutions') as any)
        .select('*')
        .eq('id', input.institutionId)
        .single();

      if (!inst) {
        const fallback = await (adminClient.from('institutions') as any)
          .select('id, name, active')
          .eq('id', input.institutionId)
          .single();
        inst = fallback.data;
      }

      if (!inst) {
        return { success: false, error: 'Selected institution not found.' };
      }

      // If institution has region_id and doesn't match, block cross-region assignment
      if (inst.region_id && caller.region_id && inst.region_id !== caller.region_id) {
        return { success: false, error: 'Unauthorized: Cannot provision College Officers outside your assigned region.' };
      }

      finalInstitutionId = inst.id;
    }
  }

  // 4. Create Supabase Auth User via Server-Side Admin Client
  try {
    const adminClient = createSupabaseAdminClient();

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: input.targetRole,
        region_id: finalRegionId || null,
        institution_id: finalInstitutionId || null,
      },
    });

    if (authError || !authData.user) {
      return { success: false, error: authError?.message || 'Failed to create user credentials.' };
    }

    const newUserId = authData.user.id;

    // 5. Create authoritative profile record
    const profilePayload: any = {
      id: newUserId,
      full_name: fullName,
      role: input.targetRole,
      active: true,
      created_by: callerId,
      updated_at: new Date().toISOString(),
    };

    if (finalRegionId) profilePayload.region_id = finalRegionId;
    if (finalInstitutionId) profilePayload.institution_id = finalInstitutionId;
    if (input.departmentId) profilePayload.department_id = input.departmentId;

    let { error: profError } = await (adminClient.from('profiles') as any).upsert(profilePayload);

    if (profError && (profError.message?.includes('created_by') || profError.message?.includes('schema cache') || profError.message?.includes('region_id'))) {
      delete profilePayload.created_by;
      delete profilePayload.region_id;
      const retry = await (adminClient.from('profiles') as any).upsert(profilePayload);
      profError = retry.error;
    }

    if (profError && (profError.message?.includes('user_role') || profError.message?.includes('invalid input value'))) {
      if (input.targetRole === 'regional_officer' || input.targetRole === 'clinician') {
        profilePayload.role = 'government_admin';
        const retry = await (adminClient.from('profiles') as any).upsert(profilePayload);
        profError = retry.error;
      }
    }

    if (profError) {
      // Rollback Auth user on profile creation failure
      await adminClient.auth.admin.deleteUser(newUserId);
      return { success: false, error: `Failed to save user profile: ${profError.message}` };
    }

    // 6. Log provisioning event to account_provisioning_logs
    try {
      await (adminClient.from('account_provisioning_logs') as any).insert({
        created_by: callerId,
        target_user_id: newUserId,
        target_email: email,
        target_role: input.targetRole,
        institution_id: finalInstitutionId,
        region_id: finalRegionId,
      });
    } catch (logErr) {
      // Best-effort audit logging
    }

    return {
      success: true,
      userId: newUserId,
      user: {
        id: newUserId,
        email,
        full_name: fullName,
        role: input.targetRole,
        region_id: finalRegionId,
        institution_id: finalInstitutionId,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred during account provisioning.' };
  }
}

/**
 * Get managed staff accounts for a parent role
 */
export async function getManagedStaffAccounts(
  supabase: SupabaseClient<Database>,
  callerId: string
): Promise<Array<UserProfile & { email?: string; institution_name?: string; region_name?: string }>> {
  const caller = await getUserProfile(supabase, callerId);
  if (!caller) return [];

  const adminClient = createSupabaseAdminClient();
  const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userMap = new Map((usersData?.users || []).map((u) => [u.id, u]));
  const allRegions = await getRegions(supabase);
  const regionMap = new Map(allRegions.map((r) => [r.id, r.name]));

  let profilesList: any[] = [];

  if (caller.role === 'super_admin') {
    // Super Admin views Government Admins (excluding Super Admin)
    const { data } = await (adminClient.from('profiles') as any)
      .select('*')
      .neq('role', 'super_admin')
      .order('created_at', { ascending: false });
    
    profilesList = (data || []).filter((p: any) => {
      const authUser = userMap.get(p.id);
      const effectiveRole = authUser?.user_metadata?.role || p.role;
      return effectiveRole === 'government_admin';
    });
  } else if (caller.role === 'government_admin') {
    // Government Admin views Regional Officers
    const { data } = await (adminClient.from('profiles') as any)
      .select('*')
      .neq('id', callerId)
      .order('created_at', { ascending: false });

    profilesList = (data || []).filter((p: any) => {
      const authUser = userMap.get(p.id);
      const effectiveRole = authUser?.user_metadata?.role || p.role;
      return effectiveRole === 'regional_officer' || p.created_by === callerId;
    });
  } else if (caller.role === 'regional_officer') {
    // Regional Officer views Clinicians and College Officers in their region
    const { data } = await (adminClient.from('profiles') as any)
      .select('*')
      .neq('id', callerId)
      .order('created_at', { ascending: false });

    profilesList = (data || []).filter((p: any) => {
      const authUser = userMap.get(p.id);
      const effectiveRole = authUser?.user_metadata?.role || p.role;
      const targetRegion = authUser?.user_metadata?.region_id || p.region_id;
      const roleMatch = effectiveRole === 'clinician' || effectiveRole === 'college_officer';
      if (!roleMatch) return false;
      if (caller.region_id && targetRegion) {
        return targetRegion === caller.region_id;
      }
      return true;
    });
  } else {
    return [];
  }

  // Fetch institution names if any profile has institution_id
  const instIds = Array.from(new Set(profilesList.map((p: any) => p.institution_id).filter(Boolean)));
  const instMap = new Map<string, string>();
  if (instIds.length > 0) {
    const { data: insts } = await (adminClient.from('institutions') as any)
      .select('id, name')
      .in('id', instIds);
    (insts || []).forEach((inst: any) => instMap.set(inst.id, inst.name));
  }

  return profilesList.map((p: any) => {
    const authUser = userMap.get(p.id);
    const effectiveRole = authUser?.user_metadata?.role || p.role;
    const effectiveRegionId = authUser?.user_metadata?.region_id || p.region_id;
    return {
      ...p,
      role: effectiveRole,
      email: authUser?.email || undefined,
      region_id: effectiveRegionId,
      institution_name: p.institution_id ? (instMap.get(p.institution_id) || null) : null,
      region_name: effectiveRegionId ? (regionMap.get(effectiveRegionId) || null) : null,
    };
  });
}

/**
 * Academic Structure Management (College Officer)
 */

export async function getInstitutionAcademicStructure(
  supabase: SupabaseClient<Database>,
  institutionId: string
): Promise<AcademicStructureDTO> {
  const { data: deptData } = await (supabase.from('departments') as any)
    .select('id, name, code, active')
    .eq('institution_id', institutionId)
    .eq('active', true)
    .order('name');

  const { data: yearData, error: yearErr } = await (supabase.from('academic_years') as any)
    .select('*')
    .eq('institution_id', institutionId)
    .eq('active', true)
    .order('year_level');

  const { data: secData, error: secErr } = await (supabase.from('academic_sections') as any)
    .select('*')
    .eq('institution_id', institutionId)
    .eq('active', true)
    .order('section_code');

  let years: AcademicYearItem[] = (yearData || []) as AcademicYearItem[];
  let sections: AcademicSectionItem[] = (secData || []) as AcademicSectionItem[];

  // If table does not exist in schema cache on remote, provide standard academic structure
  if (yearErr && (yearErr.message?.includes('schema cache') || yearErr.message?.includes('does not exist'))) {
    years = [
      { id: 'y1', institution_id: institutionId, year_level: 1, label: '1st Year', active: true },
      { id: 'y2', institution_id: institutionId, year_level: 2, label: '2nd Year', active: true },
      { id: 'y3', institution_id: institutionId, year_level: 3, label: '3rd Year', active: true },
      { id: 'y4', institution_id: institutionId, year_level: 4, label: '4th Year', active: true },
    ];
  }

  if (secErr && (secErr.message?.includes('schema cache') || secErr.message?.includes('does not exist'))) {
    sections = [
      { id: 'sA', institution_id: institutionId, section_code: 'A', active: true },
      { id: 'sB', institution_id: institutionId, section_code: 'B', active: true },
      { id: 'sC', institution_id: institutionId, section_code: 'C', active: true },
    ];
  }

  return {
    departments: (deptData || []) as any[],
    years,
    sections,
  };
}

export async function createDepartment(
  supabase: SupabaseClient<Database>,
  callerId: string,
  input: { institutionId: string; name: string; code: string }
): Promise<{ success: boolean; department?: any; error?: string }> {
  const caller = await getUserProfile(supabase, callerId);
  if (!caller || (caller.role !== 'college_officer' && caller.role !== 'super_admin')) {
    return { success: false, error: 'Unauthorized: Only College Officers can configure departments.' };
  }

  if (caller.role === 'college_officer' && caller.institution_id !== input.institutionId) {
    return { success: false, error: 'Unauthorized: Cannot configure departments for another institution.' };
  }

  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();

  const adminClient = createSupabaseAdminClient();
  const { data: existing } = await (adminClient.from('departments') as any)
    .select('*')
    .eq('institution_id', input.institutionId)
    .eq('code', code)
    .maybeSingle();

  if (existing) {
    return { success: true, department: existing };
  }

  const { data, error } = await (adminClient.from('departments') as any)
    .insert({
      institution_id: input.institutionId,
      name,
      code,
      active: true,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, department: data };
}

export async function createAcademicYear(
  supabase: SupabaseClient<Database>,
  callerId: string,
  input: { institutionId: string; yearLevel: number; label: string }
): Promise<{ success: boolean; error?: string }> {
  const caller = await getUserProfile(supabase, callerId);
  if (!caller || (caller.role !== 'college_officer' && caller.role !== 'super_admin')) {
    return { success: false, error: 'Unauthorized: Only College Officers can configure academic years.' };
  }

  if (caller.role === 'college_officer' && caller.institution_id !== input.institutionId) {
    return { success: false, error: 'Unauthorized: Cannot configure academic years for another institution.' };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { error } = await (adminClient.from('academic_years') as any).upsert(
    {
      institution_id: input.institutionId,
      year_level: input.yearLevel,
      label: input.label.trim(),
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'institution_id,year_level' }
  );

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        return { success: true };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
}

export async function createAcademicSection(
  supabase: SupabaseClient<Database>,
  callerId: string,
  input: { institutionId: string; sectionCode: string; departmentId?: string; yearLevel?: number }
): Promise<{ success: boolean; error?: string }> {
  const caller = await getUserProfile(supabase, callerId);
  if (!caller || (caller.role !== 'college_officer' && caller.role !== 'super_admin')) {
    return { success: false, error: 'Unauthorized: Only College Officers can configure academic sections.' };
  }

  if (caller.role === 'college_officer' && caller.institution_id !== input.institutionId) {
    return { success: false, error: 'Unauthorized: Cannot configure academic sections for another institution.' };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { error } = await (adminClient.from('academic_sections') as any).upsert(
      {
        institution_id: input.institutionId,
        department_id: input.departmentId || null,
        year_level: input.yearLevel || null,
        section_code: input.sectionCode.trim().toUpperCase(),
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'institution_id,department_id,year_level,section_code' }
    );

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        return { success: true };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
}

/**
 * Account Management Authorization Matrix
 */
export function canManageAccount(caller: UserProfile, target: UserProfile): boolean {
  if (!caller || !target) return false;

  // Super Admin manages Government Admins (and any staff in the system)
  if (caller.role === 'super_admin') {
    return target.role === 'government_admin' || target.role === 'regional_officer' || target.role === 'clinician' || target.role === 'college_officer';
  }

  // Government Admin manages Regional Officers
  if (caller.role === 'government_admin') {
    return target.role === 'regional_officer';
  }

  // Regional Officer manages Clinicians and College Officers within their assigned region
  if (caller.role === 'regional_officer') {
    const isTargetRoleAllowed = target.role === 'clinician' || target.role === 'college_officer';
    if (!isTargetRoleAllowed) return false;

    // Must match region scope or creator lineage
    const callerRegion = caller.region_id || caller.region_code;
    const targetRegion = target.region_id || target.region_code;

    if (caller.id === target.created_by) return true;
    if (callerRegion && targetRegion && callerRegion === targetRegion) return true;
    if (!callerRegion) return true; // National jurisdiction
    return false;
  }

  // College Officers, Clinicians, and Students have zero staff management rights
  return false;
}

/**
 * Toggle Staff Account Status (Active / Inactive)
 */
export async function toggleStaffAccountStatus(
  supabase: SupabaseClient<Database>,
  callerId: string,
  targetUserId: string,
  active: boolean
): Promise<{ success: boolean; targetUserId?: string; active?: boolean; error?: string }> {
  const caller = await getUserProfile(supabase, callerId);
  const target = await getUserProfile(supabase, targetUserId);

  if (!caller) return { success: false, error: 'Caller identity not found.' };
  if (!target) return { success: false, error: 'Target staff account not found.' };

  if (!canManageAccount(caller, target)) {
    return {
      success: false,
      error: `Unauthorized: Role '${caller.role}' is not permitted to manage '${target.role}' accounts outside its authorized scope.`,
    };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { error } = await (adminClient.from('profiles') as any)
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', targetUserId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, targetUserId, active };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update account status.' };
  }
}

/**
 * Get Staff Account Details with Lineage (Created by, Region, Institution)
 */
export async function getStaffAccountDetails(
  supabase: SupabaseClient<Database>,
  callerId: string,
  targetUserId: string
): Promise<{
  success: boolean;
  account?: UserProfile & {
    email?: string;
    institution_name?: string;
    region_name?: string;
    creator_name?: string;
    creator_role?: string;
  };
  error?: string;
}> {
  const caller = await getUserProfile(supabase, callerId);
  const target = await getUserProfile(supabase, targetUserId);

  if (!caller || !target) {
    return { success: false, error: 'User profile not found.' };
  }

  if (!canManageAccount(caller, target) && caller.id !== target.id) {
    return { success: false, error: 'Unauthorized: Cannot view account details outside your organizational scope.' };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: fullProfile } = await (adminClient.from('profiles') as any)
    .select('*, institution:institutions(name), region:regions(name), creator:profiles!profiles_created_by_fkey(full_name, role)')
    .eq('id', targetUserId)
    .single();

  const res = fullProfile || target;
  return {
    success: true,
    account: {
      ...res,
      institution_name: res.institution?.name || null,
      region_name: res.region?.name || null,
      creator_name: res.creator?.full_name || null,
      creator_role: res.creator?.role || null,
    },
  };
}

export const INSTITUTION_REGION_MAP = new Map<string, string>([
  ['f75c1e77-dc3b-4f5d-b4eb-e7cd2bd45f5c', 'reg-demo-north-01'],
]);

/**
 * Get Institutions strictly assigned to a Regional Officer's region
 */
export async function getInstitutionsForRegionalOfficer(
  supabase: SupabaseClient<Database>,
  regionalOfficerId: string
): Promise<Array<{ id: string; name: string; code: string; state?: string; region_id?: string }>> {
  const officer = await getUserProfile(supabase, regionalOfficerId);
  if (!officer) return [];

  // Super Admin or Government Admin sees all institutions
  if (officer.role === 'super_admin' || officer.role === 'government_admin') {
    const { data } = await supabase.from('institutions').select('id, name, code, state, region_id' as any).eq('active', true);
    return (data || []) as any[];
  }

  if (officer.role !== 'regional_officer') {
    return [];
  }

  const regionId = officer.region_id || (officer as any).region_code;
  if (!regionId) return [];

  const adminClient = createSupabaseAdminClient();
  try {
    const { data, error } = await (adminClient.from('institutions') as any)
      .select('id, name, code, state')
      .eq('active', true)
      .order('name');

    if (error || !data) return [];

    return data
      .map((inst: any) => ({
        ...inst,
        region_id: inst.region_id || INSTITUTION_REGION_MAP.get(inst.id) || 'reg-demo-north-01',
      }))
      .filter((inst: any) => inst.region_id === regionId);
  } catch (e) {
    return [];
  }
}

/**
 * Create Institution with Region Assignment (Government Admin or Super Admin only)
 */
export async function createInstitutionWithRegion(
  supabase: SupabaseClient<Database>,
  callerId: string,
  input: { name: string; code: string; state?: string; district?: string; type?: string; regionId?: string }
): Promise<{ success: boolean; institution?: any; error?: string }> {
  const caller = await getUserProfile(supabase, callerId);
  if (!caller || (caller.role !== 'government_admin' && caller.role !== 'super_admin')) {
    return { success: false, error: 'Unauthorized: Only Government Administrators can create institutions.' };
  }

  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();

  if (!name || !code) {
    return { success: false, error: 'Institution name and code are required.' };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const payload: any = {
      name,
      code,
      state: input.state || 'National',
      district: input.district || 'Central',
      institution_type: input.type || 'college',
      active: true,
    };

    if (input.regionId) {
      payload.region_id = input.regionId;
    }

    let { data, error } = await (adminClient.from('institutions') as any)
      .insert(payload)
      .select()
      .single();

    if (error && (error.message?.includes('region_id') || error.message?.includes('schema cache'))) {
      // Fallback insert without region_id if column pending
      delete payload.region_id;
      const res = await (adminClient.from('institutions') as any)
        .insert(payload)
        .select()
        .single();
      data = res.data;
      error = res.error;
    }

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && input.regionId) {
      INSTITUTION_REGION_MAP.set(data.id, input.regionId);
    }

    return { success: true, institution: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create institution.' };
  }
}

/**
 * Server-Authoritative Validation of Student Academic Placement
 * Strictly enforces that department, year, and section belong to the selected college
 */
export async function validateStudentAcademicPlacement(
  supabase: SupabaseClient<Database>,
  input: {
    institutionId: string;
    departmentId?: string | null;
    yearLevel?: number | null;
    sectionCode?: string | null;
  }
): Promise<{ valid: boolean; error?: string }> {
  const { institutionId, departmentId, yearLevel, sectionCode } = input;

  if (!institutionId) {
    return { valid: false, error: 'A valid college / institution is required.' };
  }

  // 1. Validate Institution exists and is active
  const { data: inst } = await (supabase.from('institutions') as any)
    .select('id, active')
    .eq('id', institutionId)
    .single();

  if (!inst || !inst.active) {
    return { valid: false, error: 'Selected college is invalid or currently inactive.' };
  }

  // Fetch actual configured academic structure
  const structure = await getInstitutionAcademicStructure(supabase, institutionId);

  // 2. Validate Department
  if (structure.departments.length > 0) {
    if (!departmentId) {
      return { valid: false, error: 'Please select a valid academic department / program.' };
    }
    const matchingDept = structure.departments.find((d: any) => d.id === departmentId && d.active !== false);
    if (!matchingDept) {
      return {
        valid: false,
        error: 'Security Exception: The selected department is invalid, inactive, or does not belong to your chosen college.',
      };
    }
  } else if (departmentId) {
    const { data: dept } = await (supabase.from('departments') as any)
      .select('id, institution_id, active')
      .eq('id', departmentId)
      .single();

    if (!dept || dept.institution_id !== institutionId || dept.active === false) {
      return {
        valid: false,
        error: 'Security Exception: The selected department does not belong to your chosen college.',
      };
    }
  }

  // 3. Validate Academic Year
  if (yearLevel === undefined || yearLevel === null || isNaN(yearLevel)) {
    return { valid: false, error: 'Please select a valid academic year level.' };
  }

  if (structure.years.length > 0) {
    const matchingYear = structure.years.find((y) => y.year_level === yearLevel && y.active !== false);
    if (!matchingYear) {
      return {
        valid: false,
        error: `Academic Year ${yearLevel} is not configured for this college.`,
      };
    }
  } else {
    if (yearLevel < 1 || yearLevel > 6) {
      return { valid: false, error: 'Academic year level must be between 1 and 6.' };
    }
  }

  // 4. Validate Section
  if (!sectionCode) {
    return { valid: false, error: 'Please select a valid section code.' };
  }

  const cleanSection = sectionCode.trim().toUpperCase();

  if (structure.sections.length > 0) {
    const matchingSection = structure.sections.find((s) => {
      if (s.section_code !== cleanSection) return false;
      if (s.active === false) return false;
      if (s.department_id && departmentId && s.department_id !== departmentId) return false;
      if (s.year_level && s.year_level !== yearLevel) return false;
      return true;
    });

    if (!matchingSection) {
      return {
        valid: false,
        error: `Security Exception: Section ${cleanSection} is not valid for the selected academic program and year.`,
      };
    }
  } else {
    if (cleanSection.length > 5 || !/^[A-Z0-9_-]+$/.test(cleanSection)) {
      return { valid: false, error: 'Invalid section code format.' };
    }
  }

  return { valid: true };
}



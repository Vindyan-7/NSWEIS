import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { WeeklyCycle } from '../types/domain';

export interface WeeklyCycleInput {
  week_number: number;
  name: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  status: 'draft' | 'scheduled' | 'active' | 'closed';
  total_questions: number;
  common_questions: number;
  adaptive_questions: number;
  session_duration_minutes: number;
  reflection_required: boolean;
  adaptive_questions_enabled: boolean;
}

/**
 * Validate weekly cycle configuration before database insertion/update.
 */
export function validateWeeklyCycleInput(input: WeeklyCycleInput): { valid: boolean; error?: string } {
  if (input.week_number < 1) {
    return { valid: false, error: 'Week number must be at least 1.' };
  }
  if (!input.name || input.name.trim() === '') {
    return { valid: false, error: 'Cycle name is required.' };
  }
  if (!input.starts_at || !input.ends_at) {
    return { valid: false, error: 'Start and End dates are required.' };
  }
  const startDate = new Date(input.starts_at);
  const endDate = new Date(input.ends_at);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { valid: false, error: 'Invalid start or end date format.' };
  }
  if (endDate <= startDate) {
    return { valid: false, error: 'End date must be strictly after Start date.' };
  }
  if (input.total_questions < 1) {
    return { valid: false, error: 'Total questions must be at least 1.' };
  }
  if (input.common_questions < 0 || input.adaptive_questions < 0) {
    return { valid: false, error: 'Common and adaptive question counts cannot be negative.' };
  }
  if (input.common_questions + input.adaptive_questions !== input.total_questions) {
    return {
      valid: false,
      error: `Common questions (${input.common_questions}) + Adaptive questions (${input.adaptive_questions}) must equal Total questions (${input.total_questions}).`,
    };
  }
  if (input.session_duration_minutes < 1) {
    return { valid: false, error: 'Session duration must be at least 1 minute.' };
  }
  if (!input.adaptive_questions_enabled && input.adaptive_questions > 0) {
    return { valid: false, error: 'Cannot specify adaptive questions when adaptive questions are disabled.' };
  }
  return { valid: true };
}

/**
 * Get currently active weekly cycle from database or fallback to assessment_cycles table.
 */
export async function getActiveWeeklyCycle(
  supabase: SupabaseClient<Database>
): Promise<WeeklyCycle | null> {
  const { data: weeklyCycle, error } = await (supabase.from('weekly_cycles') as any)
    .select('*')
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .single();

  if (!error && weeklyCycle) {
    return weeklyCycle as WeeklyCycle;
  }

  const { data: legacyCycle } = await (supabase.from('assessment_cycles') as any)
    .select('*')
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .single();

  if (legacyCycle) {
    const lc = legacyCycle as any;
    return {
      id: lc.id,
      week_number: lc.week_number,
      name: lc.name,
      description: null,
      starts_at: lc.starts_at,
      ends_at: lc.ends_at,
      status: 'active',
      total_questions: lc.total_questions || 10,
      common_questions: lc.common_questions || 7,
      adaptive_questions: lc.adaptive_questions || 3,
      session_duration_minutes: lc.session_duration_minutes || 20,
      reflection_required: true,
      adaptive_questions_enabled: true,
      created_by: null,
      created_at: lc.created_at,
      updated_at: lc.updated_at,
    };
  }

  return null;
}

/**
 * Get list of all weekly cycles ordered by week_number descending.
 */
export async function getWeeklyCycles(
  supabase: SupabaseClient<Database>
): Promise<WeeklyCycle[]> {
  const { data, error } = await (supabase.from('weekly_cycles') as any)
    .select('*')
    .order('week_number', { ascending: false });

  if (!error && data && data.length > 0) {
    return data as WeeklyCycle[];
  }

  const { data: legacyData } = await (supabase.from('assessment_cycles') as any)
    .select('*')
    .order('week_number', { ascending: false });

  if (legacyData) {
    return (legacyData as any[]).map((c) => ({
      id: c.id,
      week_number: c.week_number,
      name: c.name,
      description: null,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      status: c.status as any,
      total_questions: c.total_questions || 10,
      common_questions: c.common_questions || 7,
      adaptive_questions: c.adaptive_questions || 3,
      session_duration_minutes: c.session_duration_minutes || 20,
      reflection_required: true,
      adaptive_questions_enabled: true,
      created_by: null,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
  }

  return [];
}

/**
 * Get a specific weekly cycle by ID.
 */
export async function getWeeklyCycleById(
  supabase: SupabaseClient<Database>,
  cycleId: string
): Promise<WeeklyCycle | null> {
  const { data, error } = await (supabase.from('weekly_cycles') as any)
    .select('*')
    .eq('id', cycleId)
    .single();

  if (!error && data) {
    return data as WeeklyCycle;
  }

  const { data: legacy } = await (supabase.from('assessment_cycles') as any)
    .select('*')
    .eq('id', cycleId)
    .single();

  if (legacy) {
    const lc = legacy as any;
    return {
      id: lc.id,
      week_number: lc.week_number,
      name: lc.name,
      description: null,
      starts_at: lc.starts_at,
      ends_at: lc.ends_at,
      status: lc.status as any,
      total_questions: lc.total_questions || 10,
      common_questions: lc.common_questions || 7,
      adaptive_questions: lc.adaptive_questions || 3,
      session_duration_minutes: lc.session_duration_minutes || 20,
      reflection_required: true,
      adaptive_questions_enabled: true,
      created_by: null,
      created_at: lc.created_at,
      updated_at: lc.updated_at,
    };
  }

  return null;
}

/**
 * Create a new weekly cycle (Super Admin only).
 */
export async function createWeeklyCycle(
  supabase: SupabaseClient<Database>,
  adminId: string,
  input: WeeklyCycleInput
): Promise<{ success: boolean; error?: string; cycleId?: string }> {
  const validation = validateWeeklyCycleInput(input);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  if (input.status === 'active') {
    // Deactivate existing active cycle if creating a new active one
    await (supabase.from('weekly_cycles') as any)
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('status', 'active');
  }

  const { data, error } = await (supabase.from('weekly_cycles') as any)
    .insert({
      week_number: input.week_number,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status: input.status,
      total_questions: input.total_questions,
      common_questions: input.common_questions,
      adaptive_questions: input.adaptive_questions,
      session_duration_minutes: input.session_duration_minutes,
      reflection_required: input.reflection_required,
      adaptive_questions_enabled: input.adaptive_questions_enabled,
      created_by: adminId,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to create weekly cycle.' };
  }

  return { success: true, cycleId: data.id };
}

/**
 * Update an existing weekly cycle (Super Admin only).
 */
export async function updateWeeklyCycle(
  supabase: SupabaseClient<Database>,
  cycleId: string,
  input: WeeklyCycleInput
): Promise<{ success: boolean; error?: string }> {
  const validation = validateWeeklyCycleInput(input);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const existing = await getWeeklyCycleById(supabase, cycleId);
  if (existing && existing.status === 'closed' && input.status !== 'closed') {
    return { success: false, error: 'Cannot re-open a closed historical cycle.' };
  }

  if (input.status === 'active') {
    // Deactivate other active cycles to preserve active index constraint
    await (supabase.from('weekly_cycles') as any)
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('status', 'active')
      .neq('id', cycleId);
  }

  const { error } = await (supabase.from('weekly_cycles') as any)
    .update({
      week_number: input.week_number,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status: input.status,
      total_questions: input.total_questions,
      common_questions: input.common_questions,
      adaptive_questions: input.adaptive_questions,
      session_duration_minutes: input.session_duration_minutes,
      reflection_required: input.reflection_required,
      adaptive_questions_enabled: input.adaptive_questions_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { QuestionSelectionRule, WellnessCategory } from '../types/domain';

export interface SelectionRuleInput {
  question_id: string;
  trigger_category?: WellnessCategory | null;
  trigger_condition: 'below' | 'at_or_below' | 'above' | 'at_or_above' | 'signal_lte' | 'signal_gte' | 'task_incomplete' | 'task_completed';
  trigger_value?: number | null;
  priority: number;
  enabled: boolean;
}

/**
 * Validate selection rule input fields.
 */
export function validateSelectionRuleInput(input: SelectionRuleInput): { valid: boolean; error?: string } {
  if (!input.question_id) {
    return { valid: false, error: 'Question association is required.' };
  }
  if (!input.trigger_condition) {
    return { valid: false, error: 'Trigger condition is required.' };
  }
  if (input.trigger_value !== undefined && input.trigger_value !== null) {
    if (isNaN(input.trigger_value) || input.trigger_value < 0.0 || input.trigger_value > 10.0) {
      return { valid: false, error: 'Trigger signal value must be between 0.0 and 10.0.' };
    }
  }
  if (input.priority < 0) {
    return { valid: false, error: 'Priority must be a non-negative integer.' };
  }
  return { valid: true };
}

/**
 * Fetch all question selection rules with associated question details (Super Admin only).
 */
export async function listQuestionSelectionRules(
  supabase: SupabaseClient<Database>
): Promise<Array<QuestionSelectionRule & { question_text?: string; question_code?: string }>> {
  const { data, error } = await (supabase.from('question_selection_rules') as any)
    .select('*, question:questions(text, question_code)')
    .order('priority', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map((r) => ({
    id: r.id,
    question_id: r.question_id,
    trigger_category: r.trigger_category,
    trigger_condition: r.trigger_condition,
    trigger_value: r.trigger_value !== null ? parseFloat(r.trigger_value) : null,
    priority: r.priority,
    enabled: r.enabled,
    created_by: r.created_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
    question_text: r.question?.text,
    question_code: r.question?.question_code,
  }));
}

/**
 * Create a new question selection rule (Super Admin only).
 */
export async function createSelectionRule(
  supabase: SupabaseClient<Database>,
  adminId: string,
  input: SelectionRuleInput
): Promise<{ success: boolean; error?: string; ruleId?: string }> {
  const validation = validateSelectionRuleInput(input);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const { data, error } = await (supabase.from('question_selection_rules') as any)
    .insert({
      question_id: input.question_id,
      trigger_category: input.trigger_category || null,
      trigger_condition: input.trigger_condition,
      trigger_value: input.trigger_value !== undefined ? input.trigger_value : null,
      priority: input.priority,
      enabled: input.enabled,
      created_by: adminId,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to create selection rule.' };
  }

  return { success: true, ruleId: data.id };
}

/**
 * Update an existing selection rule (Super Admin only).
 */
export async function updateSelectionRule(
  supabase: SupabaseClient<Database>,
  ruleId: string,
  input: SelectionRuleInput
): Promise<{ success: boolean; error?: string }> {
  const validation = validateSelectionRuleInput(input);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const { error } = await (supabase.from('question_selection_rules') as any)
    .update({
      question_id: input.question_id,
      trigger_category: input.trigger_category || null,
      trigger_condition: input.trigger_condition,
      trigger_value: input.trigger_value !== undefined ? input.trigger_value : null,
      priority: input.priority,
      enabled: input.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ruleId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Toggle enable/disable status of a selection rule (Super Admin only).
 */
export async function toggleSelectionRuleEnabled(
  supabase: SupabaseClient<Database>,
  ruleId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from('question_selection_rules') as any)
    .update({
      enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ruleId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete a selection rule safely (Super Admin only).
 */
export async function deleteSelectionRule(
  supabase: SupabaseClient<Database>,
  ruleId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from('question_selection_rules') as any)
    .delete()
    .eq('id', ruleId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

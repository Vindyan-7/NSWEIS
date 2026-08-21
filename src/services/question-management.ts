import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { Question, WellnessCategory, QuestionImport } from '../types/domain';

export interface QuestionFilters {
  weekNumber?: number;
  departmentCode?: string;
  searchQuery?: string;
  reusableOnly?: boolean;
  adaptiveOnly?: boolean;
  activeState?: 'active' | 'archived' | 'all';
  category?: WellnessCategory;
}

export interface CsvValidationResult {
  valid: boolean;
  errors: string[];
  totalQuestions: number;
  totalOptions: number;
}

const VALID_CATEGORIES: WellnessCategory[] = [
  'academic',
  'sleep_rest',
  'emotional_wellbeing',
  'social_connection',
  'family_home',
  'financial',
  'career',
  'campus_experience',
  'physical_wellbeing',
  'digital_balance',
];

export async function listQuestions(
  supabase: SupabaseClient<Database>,
  filters?: QuestionFilters
): Promise<Question[]> {
  let query = (supabase.from('questions') as any)
    .select('*, options:question_options(*)');

  // Filter by active status
  if (!filters?.activeState || filters.activeState === 'active') {
    query = query.eq('active', true);
  } else if (filters.activeState === 'archived') {
    query = query.eq('active', false);
  }

  if (filters?.weekNumber !== undefined && filters.weekNumber > 0) {
    query = query.eq('week_number', filters.weekNumber);
  }

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.departmentCode && filters.departmentCode !== 'ALL') {
    query = query.in('target_department', ['ALL', filters.departmentCode]);
  }

  if (filters?.reusableOnly) {
    query = query.eq('reusable', true);
  }

  if (filters?.adaptiveOnly) {
    query = query.eq('adaptive_enabled', true);
  }

  if (filters?.searchQuery && filters.searchQuery.trim() !== '') {
    const term = `%${filters.searchQuery.trim()}%`;
    query = query.or(`question_code.ilike.${term},text.ilike.${term}`);
  }

  const { data, error } = await query
    .order('week_number', { ascending: true })
    .order('order_index', { ascending: true });

  if (error || !data) return [];

  const sorted = data.map((q: any) => ({
    ...q,
    options: (q.options || []).sort((a: any, b: any) => a.order_index - b.order_index),
  }));

  return sorted as unknown as Question[];
}

export async function getQuestionDetails(
  supabase: SupabaseClient<Database>,
  questionId: string
): Promise<Question | null> {
  const { data, error } = await (supabase.from('questions') as any)
    .select('*, options:question_options(*)')
    .eq('id', questionId)
    .single();

  if (error || !data) return null;

  const q = data as any;
  q.options = (q.options || []).sort((a: any, b: any) => a.order_index - b.order_index);
  return q as Question;
}

export async function createQuestionWithOptions(
  supabase: SupabaseClient<Database>,
  questionData: {
    question_code: string;
    week_number: number;
    text: string;
    category: WellnessCategory;
    target_department: string;
    adaptive_trigger_group?: string | null;
    required?: boolean;
    reusable?: boolean;
    cooldown_weeks?: number;
    maximum_uses?: number | null;
    adaptive_enabled?: boolean;
    weight?: number;
    order_index?: number;
  },
  optionsData: Array<{
    option_code: string;
    label: string;
    score: number;
    signal_value: number;
    follow_up_group?: string | null;
    order_index: number;
  }>
): Promise<{ success: boolean; error?: string; questionId?: string }> {
  // Check for duplicate code
  const { data: existing } = await (supabase.from('questions') as any)
    .select('id')
    .eq('question_code', questionData.question_code)
    .single();

  if (existing) {
    return { success: false, error: `Question code '${questionData.question_code}' already exists.` };
  }

  const { data: insertedQuestion, error: qError } = await (supabase.from('questions') as any)
    .insert({
      question_code: questionData.question_code,
      week_number: questionData.week_number,
      text: questionData.text,
      category: questionData.category,
      target_department: questionData.target_department || 'ALL',
      adaptive_trigger_group: questionData.adaptive_trigger_group || null,
      required: questionData.required ?? true,
      reusable: questionData.reusable ?? true,
      cooldown_weeks: questionData.cooldown_weeks ?? 0,
      maximum_uses: questionData.maximum_uses !== undefined ? questionData.maximum_uses : null,
      adaptive_enabled: questionData.adaptive_enabled ?? true,
      weight: questionData.weight ?? 1.0,
      order_index: questionData.order_index ?? 1,
      question_type: 'single_choice',
      active: true,
      is_base_question: true,
    })
    .select()
    .single();

  if (qError || !insertedQuestion) {
    return { success: false, error: qError?.message || 'Failed to insert question.' };
  }

  const qId = (insertedQuestion as any).id;

  if (optionsData.length > 0) {
    const optionInserts = optionsData.map((opt) => ({
      question_id: qId,
      label: opt.label,
      score: opt.score,
      order_index: opt.order_index,
      option_code: opt.option_code,
      signal_value: opt.signal_value,
      follow_up_group: opt.follow_up_group || null,
    }));

    const { error: optError } = await (supabase.from('question_options') as any)
      .insert(optionInserts);

    if (optError) {
      return { success: false, error: `Question created, but option error: ${optError.message}` };
    }
  }

  return { success: true, questionId: qId };
}

export async function updateQuestionWithOptions(
  supabase: SupabaseClient<Database>,
  questionId: string,
  questionData: {
    week_number?: number;
    text?: string;
    category?: WellnessCategory;
    target_department?: string;
    adaptive_trigger_group?: string | null;
    required?: boolean;
    reusable?: boolean;
    cooldown_weeks?: number;
    maximum_uses?: number | null;
    adaptive_enabled?: boolean;
    active?: boolean;
    order_index?: number;
  },
  optionsData?: Array<{
    id?: string;
    option_code: string;
    label: string;
    score: number;
    signal_value: number;
    follow_up_group?: string | null;
    order_index: number;
  }>
): Promise<{ success: boolean; error?: string }> {
  const updatePayload: any = {
    updated_at: new Date().toISOString(),
  };

  if (questionData.week_number !== undefined) updatePayload.week_number = questionData.week_number;
  if (questionData.text !== undefined) updatePayload.text = questionData.text;
  if (questionData.category !== undefined) updatePayload.category = questionData.category;
  if (questionData.target_department !== undefined) updatePayload.target_department = questionData.target_department;
  if (questionData.adaptive_trigger_group !== undefined) updatePayload.adaptive_trigger_group = questionData.adaptive_trigger_group;
  if (questionData.required !== undefined) updatePayload.required = questionData.required;
  if (questionData.reusable !== undefined) updatePayload.reusable = questionData.reusable;
  if (questionData.cooldown_weeks !== undefined) updatePayload.cooldown_weeks = questionData.cooldown_weeks;
  if (questionData.maximum_uses !== undefined) updatePayload.maximum_uses = questionData.maximum_uses;
  if (questionData.adaptive_enabled !== undefined) updatePayload.adaptive_enabled = questionData.adaptive_enabled;
  if (questionData.active !== undefined) updatePayload.active = questionData.active;
  if (questionData.order_index !== undefined) updatePayload.order_index = questionData.order_index;

  const { error: qError } = await (supabase as any)
    .from('questions')
    .update(updatePayload)
    .eq('id', questionId);

  if (qError) return { success: false, error: qError.message };

  if (optionsData) {
    // Delete existing options and insert updated ones cleanly
    await (supabase.from('question_options') as any).delete().eq('question_id', questionId);

    const optionInserts = optionsData.map((opt) => ({
      question_id: questionId,
      label: opt.label,
      score: opt.score,
      order_index: opt.order_index,
      option_code: opt.option_code,
      signal_value: opt.signal_value,
      follow_up_group: opt.follow_up_group || null,
    }));

    const { error: optError } = await (supabase.from('question_options') as any)
      .insert(optionInserts);

    if (optError) return { success: false, error: optError.message };
  }

  return { success: true };
}

/**
 * Soft-archive a question preserving historical responses.
 */
export async function archiveQuestion(
  supabase: SupabaseClient<Database>,
  questionId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from('questions') as any)
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', questionId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Unarchive / reactivate a question.
 */
export async function unarchiveQuestion(
  supabase: SupabaseClient<Database>,
  questionId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from('questions') as any)
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq('id', questionId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Simple robust CSV string parser handling quotes
export function parseCsvLines(csvText: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentLine.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentLine.push(currentField.trim());
      if (currentLine.some((f) => f.length > 0)) {
        lines.push(currentLine);
      }
      currentLine = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some((f) => f.length > 0)) {
      lines.push(currentLine);
    }
  }

  return lines;
}

export function validateCsvFiles(
  questionsCsvText: string,
  optionsCsvText: string,
  validDepartmentCodes?: Set<string> | string[]
): {
  valid: boolean;
  errors: string[];
  parsedQuestions: any[];
  parsedOptions: any[];
} {
  const errors: string[] = [];
  const qLines = parseCsvLines(questionsCsvText);
  const oLines = parseCsvLines(optionsCsvText);

  if (qLines.length < 2) {
    errors.push('Questions CSV is empty or missing data rows.');
    return { valid: false, errors, parsedQuestions: [], parsedOptions: [] };
  }

  if (oLines.length < 2) {
    errors.push('Options CSV is empty or missing data rows.');
    return { valid: false, errors, parsedQuestions: [], parsedOptions: [] };
  }

  const qHeaders = qLines[0].map((h) => h.toLowerCase());
  const oHeaders = oLines[0].map((h) => h.toLowerCase());

  // Required headers verification
  const requiredQHeaders = ['question_code', 'week_number', 'question_text', 'category', 'target_department'];
  const requiredOHeaders = ['question_code', 'option_code', 'option_text', 'signal_value', 'display_order'];

  for (const reqH of requiredQHeaders) {
    if (!qHeaders.includes(reqH)) {
      errors.push(`Questions CSV missing required header: ${reqH}`);
    }
  }

  for (const reqH of requiredOHeaders) {
    if (!oHeaders.includes(reqH)) {
      errors.push(`Options CSV missing required header: ${reqH}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, parsedQuestions: [], parsedOptions: [] };
  }

  const qCodeIdx = qHeaders.indexOf('question_code');
  const qWeekIdx = qHeaders.indexOf('week_number');
  const qTextIdx = qHeaders.indexOf('question_text');
  const qCatIdx = qHeaders.indexOf('category');
  const qDeptIdx = qHeaders.indexOf('target_department');
  const qTrigIdx = qHeaders.indexOf('adaptive_trigger_group');
  const qReqIdx = qHeaders.indexOf('required');

  const deptSet = validDepartmentCodes instanceof Set
    ? validDepartmentCodes
    : new Set(validDepartmentCodes || []);

  const parsedQuestions: any[] = [];
  const seenQCodes = new Set<string>();

  for (let r = 1; r < qLines.length; r++) {
    const row = qLines[r];
    const rowNum = r + 1;
    const qCode = row[qCodeIdx]?.trim();
    const weekStr = row[qWeekIdx]?.trim();
    const qText = row[qTextIdx]?.trim();
    const cat = row[qCatIdx]?.trim() as WellnessCategory;
    const dept = row[qDeptIdx]?.trim() || 'ALL';
    const trig = qTrigIdx !== -1 ? row[qTrigIdx]?.trim() : null;
    const reqStr = qReqIdx !== -1 ? row[qReqIdx]?.trim() : '';

    if (!qCode) {
      errors.push(`Questions CSV Row ${rowNum}: Missing question_code.`);
      continue;
    }

    if (seenQCodes.has(qCode)) {
      errors.push(`Questions CSV Row ${rowNum}: Duplicate question_code '${qCode}' in file.`);
    } else {
      seenQCodes.add(qCode);
    }

    const weekNum = parseInt(weekStr, 10);
    if (isNaN(weekNum) || weekNum < 1) {
      errors.push(`Questions CSV Row ${rowNum} (${qCode}): Invalid week_number '${weekStr}'. Must be an integer >= 1.`);
    }

    if (!qText) {
      errors.push(`Questions CSV Row ${rowNum} (${qCode}): Missing question_text.`);
    }

    if (!VALID_CATEGORIES.includes(cat)) {
      errors.push(`Questions CSV Row ${rowNum} (${qCode}): Invalid category '${cat}'.`);
    }

    // Dynamic Department Validation
    if (dept !== 'ALL' && deptSet.size > 0 && !deptSet.has(dept)) {
      errors.push(`Questions CSV Row ${rowNum} (${qCode}): target_department '${dept}' does not match an existing department.`);
    }

    // Strict Boolean Validation
    let reqBool = true;
    const reqLower = reqStr.toLowerCase();
    if (reqLower === 'true') {
      reqBool = true;
    } else if (reqLower === 'false') {
      reqBool = false;
    } else {
      errors.push(`Questions CSV Row ${rowNum} (${qCode}): Invalid required value '${reqStr}'. Must be 'true' or 'false'.`);
    }

    parsedQuestions.push({
      question_code: qCode,
      week_number: weekNum,
      text: qText,
      category: cat,
      target_department: dept,
      adaptive_trigger_group: trig || null,
      required: reqBool,
      order_index: r,
    });
  }

  const oQCodeIdx = oHeaders.indexOf('question_code');
  const oCodeIdx = oHeaders.indexOf('option_code');
  const oTextIdx = oHeaders.indexOf('option_text');
  const oSigIdx = oHeaders.indexOf('signal_value');
  const oFolIdx = oHeaders.indexOf('follow_up_group');
  const oOrdIdx = oHeaders.indexOf('display_order');

  const parsedOptions: any[] = [];
  const optionsPerQ = new Map<string, Set<string>>();

  for (let r = 1; r < oLines.length; r++) {
    const row = oLines[r];
    const rowNum = r + 1;
    const qCode = row[oQCodeIdx]?.trim();
    const oCode = row[oCodeIdx]?.trim();
    const oText = row[oTextIdx]?.trim();
    const sigStr = row[oSigIdx]?.trim();
    const folGroup = oFolIdx !== -1 ? row[oFolIdx]?.trim() : null;
    const ordStr = row[oOrdIdx]?.trim();

    if (!qCode) {
      errors.push(`Options CSV Row ${rowNum}: Missing question_code.`);
      continue;
    }

    if (!seenQCodes.has(qCode)) {
      errors.push(`Options CSV Row ${rowNum}: References unknown question_code '${qCode}' not present in Questions CSV.`);
    }

    if (!oCode) {
      errors.push(`Options CSV Row ${rowNum} (${qCode}): Missing option_code.`);
    }

    if (!oText) {
      errors.push(`Options CSV Row ${rowNum} (${qCode}): Missing option_text.`);
    }

    const sigVal = parseFloat(sigStr);
    if (isNaN(sigVal) || sigVal < 0 || sigVal > 10) {
      errors.push(`Options CSV Row ${rowNum} (${qCode}/${oCode}): Invalid signal_value '${sigStr}'. Must be a number between 0.0 and 10.0.`);
    }

    const ordVal = parseInt(ordStr || '1', 10);

    if (qCode && oCode) {
      if (!optionsPerQ.has(qCode)) optionsPerQ.set(qCode, new Set());
      const qOptSet = optionsPerQ.get(qCode)!;
      if (qOptSet.has(oCode)) {
        errors.push(`Options CSV Row ${rowNum}: Duplicate option_code '${oCode}' for question '${qCode}'.`);
      } else {
        qOptSet.add(oCode);
      }
    }

    parsedOptions.push({
      question_code: qCode,
      option_code: oCode,
      label: oText,
      signal_value: sigVal,
      score: sigVal,
      follow_up_group: folGroup || null,
      order_index: isNaN(ordVal) ? 1 : ordVal,
    });
  }

  // Ensure every question has at least 1 option
  for (const qCode of seenQCodes) {
    const opts = optionsPerQ.get(qCode);
    if (!opts || opts.size === 0) {
      errors.push(`Question '${qCode}' has no options defined in Options CSV.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    parsedQuestions,
    parsedOptions,
  };
}

export async function importQuestionCsvs(
  supabase: SupabaseClient<Database>,
  adminId: string,
  filename: string,
  questionsCsvText: string,
  optionsCsvText: string
): Promise<{ success: boolean; errors?: string[]; importedCount?: number }> {
  // Fetch existing department codes from database dynamically
  const { data: deptData } = await (supabase.from('departments') as any).select('code');
  const validDeptCodes = new Set<string>((deptData || []).map((d: any) => d.code));

  const validation = validateCsvFiles(questionsCsvText, optionsCsvText, validDeptCodes);

  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  // Check database for pre-existing question codes
  const qCodes = validation.parsedQuestions.map((q) => q.question_code);
  const { data: existingQ } = await (supabase.from('questions') as any)
    .select('question_code')
    .in('question_code', qCodes);

  if (existingQ && existingQ.length > 0) {
    const dupes = existingQ.map((e: any) => e.question_code).join(', ');
    return {
      success: false,
      errors: [`Import rejected: Question code(s) already exist in database: ${dupes}. Use the Edit form to update existing questions.`],
    };
  }

  let importedQuestions = 0;

  for (const qData of validation.parsedQuestions) {
    const qOptions = validation.parsedOptions.filter((o) => o.question_code === qData.question_code);

    const res = await createQuestionWithOptions(
      supabase,
      {
        question_code: qData.question_code,
        week_number: qData.week_number,
        text: qData.text,
        category: qData.category,
        target_department: qData.target_department,
        adaptive_trigger_group: qData.adaptive_trigger_group,
        required: qData.required,
        order_index: qData.order_index,
      },
      qOptions
    );

    if (res.success) {
      importedQuestions++;
    } else {
      return {
        success: false,
        errors: [`Failed to insert question '${qData.question_code}': ${res.error}`],
      };
    }
  }

  // Record import audit history
  await (supabase.from('question_imports') as any).insert({
    admin_id: adminId,
    filename,
    total_rows: validation.parsedQuestions.length,
    successful_rows: importedQuestions,
    error_log: null,
  });

  return { success: true, importedCount: importedQuestions };
}

export async function getImportHistory(
  supabase: SupabaseClient<Database>
): Promise<QuestionImport[]> {
  const { data, error } = await (supabase.from('question_imports') as any)
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as unknown as QuestionImport[];
}

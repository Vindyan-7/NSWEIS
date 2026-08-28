import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { WellnessBand } from '../types/domain';

// BUILD_PLAN.md Phase 5 — the crisis safety path.
//
// NSWEIS is a general wellness screener, not a validated risk instrument
// (see NonClinicalDisclaimer). The only acute signal it currently has is the
// overall band computed by lib/scoring/engine.ts landing on 'elevated', the
// most severe of the four bands. That is a coarse trigger — it is not tuned
// to any specific risk item — so it is deliberately generous: it is meant to
// over-trigger and hand off to real resources, not to diagnose.

export const CRISIS_BAND: WellnessBand = 'elevated';

export interface CrisisEscalationDTO {
  id: string;
  assessment_id: string;
  student_id: string;
  institution_id: string;
  triggered_band: string;
  requested_contact: boolean;
  requested_contact_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface CounsellorContact {
  name: string | null;
  phone: string | null;
}

/**
 * Best-effort: log that a completed assessment landed in the acute band.
 * Upserts on assessment_id so re-submission / re-render never duplicates
 * the record. Never throws — a logging failure must not block the student
 * from seeing their results.
 */
export async function recordCrisisTrigger(
  supabase: SupabaseClient<Database>,
  assessmentId: string,
  studentId: string,
  institutionId: string,
  band: WellnessBand
): Promise<void> {
  if (band !== CRISIS_BAND) return;
  try {
    await (supabase.from('crisis_escalations' as any) as any).upsert(
      {
        assessment_id: assessmentId,
        student_id: studentId,
        institution_id: institutionId,
        triggered_band: band,
      },
      { onConflict: 'assessment_id', ignoreDuplicates: true }
    );
  } catch {
    // Best-effort. The interstitial still renders from the freshly
    // computed band even if this row never lands.
  }
}

export async function getCrisisEscalation(
  supabase: SupabaseClient<Database>,
  assessmentId: string
): Promise<CrisisEscalationDTO | null> {
  try {
    const { data } = await (supabase.from('crisis_escalations' as any) as any)
      .select('*')
      .eq('assessment_id', assessmentId)
      .maybeSingle();
    return (data as CrisisEscalationDTO) || null;
  } catch {
    return null;
  }
}

/** The student has seen the interstitial and chosen to continue. */
export async function acknowledgeCrisisEscalation(
  supabase: SupabaseClient<Database>,
  assessmentId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await (supabase.from('crisis_escalations' as any) as any)
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('assessment_id', assessmentId)
      .eq('student_id', studentId);
    return { success: !error, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err?.message || 'unknown error' };
  }
}

/**
 * The student's own choice to be connected to their campus counsellor.
 * Notifies nobody unless this is called — it is never triggered by the
 * acute band alone.
 */
export async function requestCrisisContact(
  supabase: SupabaseClient<Database>,
  assessmentId: string,
  studentId: string
): Promise<boolean> {
  try {
    const { error } = await (supabase.from('crisis_escalations' as any) as any)
      .update({ requested_contact: true, requested_contact_at: new Date().toISOString() })
      .eq('assessment_id', assessmentId)
      .eq('student_id', studentId);
    return !error;
  } catch {
    return false;
  }
}

export async function getInstitutionCounsellorContact(
  supabase: SupabaseClient<Database>,
  institutionId: string | null | undefined
): Promise<CounsellorContact> {
  if (!institutionId) return { name: null, phone: null };
  try {
    const { data } = await (supabase.from('institutions' as any) as any)
      .select('counsellor_name, counsellor_phone')
      .eq('id', institutionId)
      .maybeSingle();
    return {
      name: (data as any)?.counsellor_name || null,
      phone: (data as any)?.counsellor_phone || null,
    };
  } catch {
    return { name: null, phone: null };
  }
}

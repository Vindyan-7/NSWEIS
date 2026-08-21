import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export interface PrivacyConsentDTO {
  id: string;
  user_id: string;
  purpose: string;
  consent_status: 'active' | 'withdrawn';
  policy_version: string;
  consented_at: string;
  withdrawn_at: string | null;
}

export interface PrivacyRequestDTO {
  id: string;
  user_id: string;
  request_type: 'access' | 'correction' | 'withdrawal' | 'deletion' | 'grievance';
  status: 'submitted' | 'under_review' | 'resolved';
  requested_at: string;
  resolved_at: string | null;
  notes: string | null;
}

export interface PrivacyAuditLogDTO {
  id: string;
  actor_user_id: string | null;
  actor_role: string;
  institution_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  purpose: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ProcessingPurposeDTO {
  purpose_key: string;
  title: string;
  description: string;
  data_categories: string[];
  active: boolean;
}

export interface RetentionPolicyDTO {
  data_category: string;
  purpose: string;
  retention_description: string;
  active: boolean;
}

// In-memory fallback stores for demo resilience
const inMemoryConsents = new Map<string, PrivacyConsentDTO>();
const inMemoryRequests = new Map<string, PrivacyRequestDTO[]>();
const inMemoryAuditLogs: PrivacyAuditLogDTO[] = [];

// Static Data Purpose Registry
export function getDataProcessingPurposes(): ProcessingPurposeDTO[] {
  return [
    {
      purpose_key: 'student_wellbeing_support',
      title: 'Student Well-being Reflection & Support',
      description: 'Support confidential student well-being self-reflection and provide non-clinical supportive guidance.',
      data_categories: ['account_metadata', 'weekly_reflection_responses', 'supportive_focus_areas'],
      active: true,
    },
    {
      purpose_key: 'anonymous_institutional_intelligence',
      title: 'Anonymous Institutional Intelligence',
      description: 'Provide anonymous aggregate well-being trends for institutional support planning.',
      data_categories: ['aggregate_completion_rates', 'aggregate_category_indicators'],
      active: true,
    },
    {
      purpose_key: 'aggregate_government_oversight',
      title: 'Government Regional Oversight',
      description: 'High-level regional participation trends across authorized institutions for policy planning.',
      data_categories: ['aggregate_institutional_completion_rates'],
      active: true,
    },
  ];
}

// Static Data Retention Policies
export function getDataRetentionPolicies(): RetentionPolicyDTO[] {
  return [
    {
      data_category: 'Identifiable Account Data',
      purpose: 'student_wellbeing_support',
      retention_description: 'Retained for active student enrollment duration, subject to institutional retention policies.',
      active: true,
    },
    {
      data_category: 'Private Reflection Data',
      purpose: 'student_wellbeing_support',
      retention_description: 'Retained only for student self-reflection history; confidential and inaccessible to officers.',
      active: true,
    },
    {
      data_category: 'Anonymous Aggregate Intelligence',
      purpose: 'anonymous_institutional_intelligence',
      retention_description: 'Retained in aggregate form for long-term institutional trend analysis.',
      active: true,
    },
  ];
}

// Fetch Student Consent
export async function getStudentConsent(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PrivacyConsentDTO> {
  try {
    const { data, error } = await (supabase.from('privacy_consents' as any) as any)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      return data as PrivacyConsentDTO;
    }
  } catch (err) {
    // DB table fallback
  }

  if (inMemoryConsents.has(userId)) {
    return inMemoryConsents.get(userId)!;
  }

  const defaultConsent: PrivacyConsentDTO = {
    id: `consent-${userId}`,
    user_id: userId,
    purpose: 'student_wellbeing_support',
    consent_status: 'active',
    policy_version: 'v1.0',
    consented_at: new Date().toISOString(),
    withdrawn_at: null,
  };

  inMemoryConsents.set(userId, defaultConsent);
  return defaultConsent;
}

// Update Student Consent Status
export async function updateStudentConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  consentStatus: 'active' | 'withdrawn'
): Promise<PrivacyConsentDTO> {
  const now = new Date().toISOString();

  try {
    const { data, error } = await (supabase.from('privacy_consents' as any) as any)
      .upsert(
        {
          user_id: userId,
          purpose: 'student_wellbeing_support',
          consent_status: consentStatus,
          policy_version: 'v1.0',
          consented_at: now,
          withdrawn_at: consentStatus === 'withdrawn' ? now : null,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (!error && data) {
      await logPrivacyAuditEvent(
        supabase,
        userId,
        'student',
        consentStatus === 'active' ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN',
        'privacy_consent',
        data.id,
        'student_wellbeing_support',
        { consent_status: consentStatus, policy_version: 'v1.0' }
      );
      return data as PrivacyConsentDTO;
    }
  } catch (err) {
    // Fallback
  }

  const updatedConsent: PrivacyConsentDTO = {
    id: `consent-${userId}`,
    user_id: userId,
    purpose: 'student_wellbeing_support',
    consent_status: consentStatus,
    policy_version: 'v1.0',
    consented_at: now,
    withdrawn_at: consentStatus === 'withdrawn' ? now : null,
  };

  inMemoryConsents.set(userId, updatedConsent);

  await logPrivacyAuditEvent(
    supabase,
    userId,
    'student',
    consentStatus === 'active' ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN',
    'privacy_consent',
    updatedConsent.id,
    'student_wellbeing_support',
    { consent_status: consentStatus, policy_version: 'v1.0' }
  );

  return updatedConsent;
}

// Fetch Student Privacy Requests
export async function getStudentPrivacyRequests(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PrivacyRequestDTO[]> {
  try {
    const { data, error } = await (supabase.from('privacy_requests' as any) as any)
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });

    if (!error && data) {
      return data as PrivacyRequestDTO[];
    }
  } catch (err) {
    // Fallback
  }

  return inMemoryRequests.get(userId) || [];
}

// Create Privacy Request
export async function createPrivacyRequest(
  supabase: SupabaseClient<Database>,
  userId: string,
  requestType: PrivacyRequestDTO['request_type'],
  notes?: string
): Promise<PrivacyRequestDTO> {
  const now = new Date().toISOString();

  try {
    const { data, error } = await (supabase.from('privacy_requests' as any) as any)
      .insert([
        {
          user_id: userId,
          request_type: requestType,
          status: 'submitted',
          requested_at: now,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (!error && data) {
      await logPrivacyAuditEvent(
        supabase,
        userId,
        'student',
        'PRIVACY_REQUEST_CREATED',
        'privacy_request',
        data.id,
        'student_wellbeing_support',
        { request_type: requestType }
      );
      return data as PrivacyRequestDTO;
    }
  } catch (err) {
    // Fallback
  }

  const newReq: PrivacyRequestDTO = {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId,
    request_type: requestType,
    status: 'submitted',
    requested_at: now,
    resolved_at: null,
    notes: notes || null,
  };

  const list = inMemoryRequests.get(userId) || [];
  list.unshift(newReq);
  inMemoryRequests.set(userId, list);

  await logPrivacyAuditEvent(
    supabase,
    userId,
    'student',
    'PRIVACY_REQUEST_CREATED',
    'privacy_request',
    newReq.id,
    'student_wellbeing_support',
    { request_type: requestType }
  );

  return newReq;
}

// Log Privacy Audit Event (Never logs private reflection text or raw response scores!)
export async function logPrivacyAuditEvent(
  supabase: SupabaseClient<Database>,
  actorUserId: string | null,
  actorRole: string,
  action: string,
  resourceType: string,
  resourceId?: string | null,
  purpose: string = 'student_wellbeing_support',
  metadata: Record<string, any> = {}
): Promise<void> {
  const safeMetadata = { ...metadata };
  delete safeMetadata.text_response;
  delete safeMetadata.reflection_text;
  delete safeMetadata.score;
  delete safeMetadata.answers;

  const now = new Date().toISOString();

  try {
    await (supabase.from('privacy_audit_logs' as any) as any).insert([
      {
        actor_user_id: actorUserId,
        actor_role: actorRole,
        action: action,
        resource_type: resourceType,
        resource_id: resourceId || null,
        purpose: purpose,
        metadata: safeMetadata,
        created_at: now,
      },
    ]);
  } catch (err) {
    // Fallback
  }

  inMemoryAuditLogs.push({
    id: `log-${Date.now()}`,
    actor_user_id: actorUserId,
    actor_role: actorRole,
    institution_id: null,
    action: action,
    resource_type: resourceType,
    resource_id: resourceId || null,
    purpose: purpose,
    metadata: safeMetadata,
    created_at: now,
  });
}

export function getPrivacyAuditLogs(): PrivacyAuditLogDTO[] {
  return [...inMemoryAuditLogs];
}

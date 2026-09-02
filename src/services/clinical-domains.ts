import type { WellnessCategory } from '../types/domain';

export type ClinicalDomainId =
  | 'studies'
  | 'sleep'
  | 'mood'
  | 'stress'
  | 'over_thinking'
  | 'friends'
  | 'family'
  | 'money'
  | 'career'
  | 'college_life'
  | 'physical_health'
  | 'daily_routine'
  | 'motivation'
  | 'coping'
  | 'support';

export interface ClinicalDomain {
  id: ClinicalDomainId;
  label: string;
  dbCategory: WellnessCategory;
}

export const CLINICAL_DOMAINS: ClinicalDomain[] = [
  { id: 'studies', label: 'Studies', dbCategory: 'academic' },
  { id: 'sleep', label: 'Sleep', dbCategory: 'sleep_rest' },
  { id: 'mood', label: 'Mood', dbCategory: 'emotional_wellbeing' },
  { id: 'stress', label: 'Stress', dbCategory: 'emotional_wellbeing' },
  { id: 'over_thinking', label: 'Over-thinking', dbCategory: 'emotional_wellbeing' },
  { id: 'friends', label: 'Friends', dbCategory: 'social_connection' },
  { id: 'family', label: 'Family', dbCategory: 'family_home' },
  { id: 'money', label: 'Money', dbCategory: 'financial' },
  { id: 'career', label: 'Career', dbCategory: 'career' },
  { id: 'college_life', label: 'College life', dbCategory: 'campus_experience' },
  { id: 'physical_health', label: 'Physical Health', dbCategory: 'physical_wellbeing' },
  { id: 'daily_routine', label: 'Daily routine', dbCategory: 'family_home' },
  { id: 'motivation', label: 'Motivation', dbCategory: 'academic' },
  { id: 'coping', label: 'Coping', dbCategory: 'emotional_wellbeing' },
  { id: 'support', label: 'Support', dbCategory: 'social_connection' },
];

export function getDbCategoryForDomain(domainId: string): WellnessCategory {
  const match = CLINICAL_DOMAINS.find((d) => d.id === domainId);
  return match ? match.dbCategory : 'emotional_wellbeing';
}

export function getClinicalDomainLabel(category: string, triggerGroup?: string | null): string {
  if (triggerGroup) {
    const cleanId = triggerGroup.replace(/^clinical_domain:/, '');
    const match = CLINICAL_DOMAINS.find((d) => d.id === cleanId);
    if (match) return match.label;
  }
  const directMatch = CLINICAL_DOMAINS.find((d) => d.id === category);
  if (directMatch) return directMatch.label;

  const legacyMap: Record<string, string> = {
    academic: 'Studies',
    sleep_rest: 'Sleep',
    emotional_wellbeing: 'Mood',
    social_connection: 'Friends',
    family_home: 'Family',
    financial: 'Money',
    career: 'Career',
    campus_experience: 'College life',
    physical_wellbeing: 'Physical Health',
    digital_balance: 'Daily routine',
  };

  return legacyMap[category] || category.replace(/_/g, ' ');
}

export function getClinicalDomainId(category: string, triggerGroup?: string | null): ClinicalDomainId {
  if (triggerGroup) {
    const cleanId = triggerGroup.replace(/^clinical_domain:/, '') as ClinicalDomainId;
    if (CLINICAL_DOMAINS.some((d) => d.id === cleanId)) return cleanId;
  }
  if (CLINICAL_DOMAINS.some((d) => d.id === category)) {
    return category as ClinicalDomainId;
  }
  const defaultMap: Record<string, ClinicalDomainId> = {
    academic: 'studies',
    sleep_rest: 'sleep',
    emotional_wellbeing: 'mood',
    social_connection: 'friends',
    family_home: 'family',
    financial: 'money',
    career: 'career',
    campus_experience: 'college_life',
    physical_wellbeing: 'physical_health',
    digital_balance: 'daily_routine',
  };
  return defaultMap[category] || 'studies';
}

import fs from 'fs';
import path from 'path';
import type { AcademicYearItem, AcademicSectionItem } from './provisioning';

interface StoredInstitutionStructure {
  years: AcademicYearItem[];
  sections: AcademicSectionItem[];
}

const STORAGE_FILE = path.resolve(process.cwd(), 'src/data/academic_structure.json');

// In-memory cache
let cache: Record<string, StoredInstitutionStructure> | null = null;

function ensureLoaded(): Record<string, StoredInstitutionStructure> {
  if (cache) return cache;

  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      cache = JSON.parse(raw);
      return cache!;
    }
  } catch (err) {
    console.warn('[academicStorage] Could not read storage file, initializing empty:', err);
  }

  cache = {};
  return cache;
}

function persistCache(): void {
  if (!cache) return;
  try {
    const dir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[academicStorage] Failed to persist academic structure:', err);
  }
}

export function normalizeSectionCode(code: string): string {
  let cleaned = code.trim();
  // Strip "Section " or "Sec " prefix if the user typed it
  cleaned = cleaned.replace(/^sections?\s+/i, '').replace(/^sec\.?\s+/i, '').trim();
  return cleaned.toUpperCase();
}

export function getStoredStructure(institutionId: string): StoredInstitutionStructure {
  const data = ensureLoaded();
  if (!data[institutionId]) {
    // Standard baseline for any college
    data[institutionId] = {
      years: [
        { id: `y1-${institutionId}`, institution_id: institutionId, year_level: 1, label: '1st Year', active: true },
        { id: `y2-${institutionId}`, institution_id: institutionId, year_level: 2, label: '2nd Year', active: true },
        { id: `y3-${institutionId}`, institution_id: institutionId, year_level: 3, label: '3rd Year', active: true },
        { id: `y4-${institutionId}`, institution_id: institutionId, year_level: 4, label: '4th Year', active: true },
      ],
      sections: [
        { id: `sA-${institutionId}`, institution_id: institutionId, section_code: 'A', active: true },
        { id: `sB-${institutionId}`, institution_id: institutionId, section_code: 'B', active: true },
        { id: `sC-${institutionId}`, institution_id: institutionId, section_code: 'C', active: true },
      ],
    };
    persistCache();
  }
  return data[institutionId];
}

export function addStoredSection(
  institutionId: string,
  rawCode: string,
  departmentId?: string | null,
  yearLevel?: number | null
): AcademicSectionItem {
  const struct = getStoredStructure(institutionId);
  const cleanCode = normalizeSectionCode(rawCode);

  const existingIdx = struct.sections.findIndex(
    (s) => s.section_code.toUpperCase() === cleanCode.toUpperCase()
  );

  if (existingIdx >= 0) {
    struct.sections[existingIdx].active = true;
    struct.sections[existingIdx].department_id = departmentId || null;
    struct.sections[existingIdx].year_level = yearLevel || null;
    persistCache();
    return struct.sections[existingIdx];
  }

  const newSection: AcademicSectionItem = {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institution_id: institutionId,
    section_code: cleanCode,
    department_id: departmentId || null,
    year_level: yearLevel || null,
    active: true,
  };

  struct.sections.push(newSection);
  // Sort sections alphabetically
  struct.sections.sort((a, b) => a.section_code.localeCompare(b.section_code));

  persistCache();
  return newSection;
}

export function addStoredYear(
  institutionId: string,
  yearLevel: number,
  label: string
): AcademicYearItem {
  const struct = getStoredStructure(institutionId);
  const cleanLabel = label.trim();

  const existingIdx = struct.years.findIndex((y) => y.year_level === yearLevel);

  if (existingIdx >= 0) {
    struct.years[existingIdx].label = cleanLabel;
    struct.years[existingIdx].active = true;
    persistCache();
    return struct.years[existingIdx];
  }

  const newYear: AcademicYearItem = {
    id: `yr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institution_id: institutionId,
    year_level: yearLevel,
    label: cleanLabel,
    active: true,
  };

  struct.years.push(newYear);
  // Sort years by level
  struct.years.sort((a, b) => a.year_level - b.year_level);

  persistCache();
  return newYear;
}

export function deleteStoredSection(institutionId: string, sectionCode: string): boolean {
  const struct = getStoredStructure(institutionId);
  const cleanCode = normalizeSectionCode(sectionCode);
  const initialLen = struct.sections.length;
  struct.sections = struct.sections.filter((s) => s.section_code !== cleanCode);
  if (struct.sections.length !== initialLen) {
    persistCache();
    return true;
  }
  return false;
}

export function deleteStoredYear(institutionId: string, yearLevel: number): boolean {
  const struct = getStoredStructure(institutionId);
  const initialLen = struct.years.length;
  struct.years = struct.years.filter((y) => y.year_level !== yearLevel);
  if (struct.years.length !== initialLen) {
    persistCache();
    return true;
  }
  return false;
}

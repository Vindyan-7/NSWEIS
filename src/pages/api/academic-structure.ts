import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase/server';
import { getInstitutionAcademicStructure } from '../../services/provisioning';

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const institutionId = url.searchParams.get('institution_id');

  if (!institutionId || typeof institutionId !== 'string') {
    return new Response(JSON.stringify({ error: 'Valid institution_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createSupabaseAdminClient();

    // 1. Verify institution exists and is active
    const { data: inst, error: instErr } = await (supabase.from('institutions') as any)
      .select('id, name, code, active')
      .eq('id', institutionId)
      .single();

    if (instErr || !inst || !inst.active) {
      return new Response(
        JSON.stringify({ error: 'Institution not found or currently inactive' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Fetch actual configured academic structure
    const structure = await getInstitutionAcademicStructure(supabase, institutionId);

    // 3. Filter to public-safe DTOs
    const safeDepartments = (structure.departments || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      code: d.code,
    }));

    const safeYears = (structure.years || []).map((y: any) => ({
      id: y.id,
      year_level: y.year_level,
      label: y.label,
    }));

    const safeSections = (structure.sections || []).map((s: any) => ({
      id: s.id,
      section_code: s.section_code,
      department_id: s.department_id || null,
      year_level: s.year_level || null,
    }));

    return new Response(
      JSON.stringify({
        institution: {
          id: inst.id,
          name: inst.name,
          code: inst.code,
        },
        departments: safeDepartments,
        years: safeYears,
        sections: safeSections,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to fetch academic structure' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

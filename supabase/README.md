# NSWEIS — Permanent Manual Supabase SQL Workflow

This directory contains the operational SQL files for managing the NSWEIS database schema, seed data, and demo profile links.

---

## Operational Manual Execution Workflow

The remote Supabase database is **MANUALLY ADMINISTERED** by the Project Manager through the Supabase Dashboard SQL Editor.

### Step-by-Step Instructions

1. Open the **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your active NSWEIS project (`qbnxqcgflyogiqhddrse`).
3. Open the **SQL Editor** from the left navigation menu.
4. Click **New Query**.
5. Copy and paste the contents of the numbered SQL file in sequential order:
   - `supabase/sql/00_initial_schema.sql`
   - `supabase/sql/01_seed_demo_data.sql`
   - `supabase/sql/02_demo_student_profile.sql` *(Note: replace `REPLACE_WITH_AUTH_USER_UUID` first)*
6. Review the SQL script.
7. Click **Run** (or press Ctrl+Enter).
8. Verify that the query execution returns `Success. No rows returned` or insertion confirmations.
9. Confirm execution to Antigravity so application readiness is logged in `PROJECT_CONTEXT.md`.

---

## Directory Structure

```text
supabase/
├── sql/
│   ├── 00_initial_schema.sql        # Core tables, enums, indexes, RLS & functions
│   ├── 01_seed_demo_data.sql        # Demo institutions, departments, cycle, questions & rules
│   └── 02_demo_student_profile.sql  # Links Auth student UUID to public.profiles
├── migrations/                      # Preserved historical migration archives
├── seed.sql                         # Historical seed archive
└── README.md                        # Workflow guide
```

---

## Rules for Future Database Changes
- Every new database change requires a **NEW numbered SQL file** in `supabase/sql/` (e.g. `03_assessment_updates.sql`).
- SQL files must contain standard header comments (`ID`, `Feature`, `Purpose`, `Dependencies`, `Status`).
- SQL files must be explicit and safe.
- Antigravity will never request database passwords or run automated CLI migrations against production/staging.

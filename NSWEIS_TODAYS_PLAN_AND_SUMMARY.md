# NSWEIS — TODAY'S PLAN & IMPLEMENTATION SUMMARY

**Date:** 2026-08-27

## Core Decision

Continue with the existing NSWEIS project (Option A). Do not rebuild from scratch.

The platform should become a clean, production/judge-ready system connecting:

Student → Private Reflection → Personalized Support → Anonymous Institutional Intelligence → Institutional Action → Regional/Government Oversight.

## Final Role Model

Roles:

- `student`
- `college_officer`
- `regional_officer`
- `government_admin`
- `clinician`
- `super_admin`

### Account Creation Rule

**Only students can self-register publicly.**

Public signup creates **student accounts only**.

Students provide their own:

- Email
- Password
- Name
- Institution/College
- Branch/Department
- Year
- Section
- Required profile information
- Privacy/DPDP consent

The signup flow links the student to an existing active college.

All privileged roles are **database-provisioned**:

- College Officer
- Regional Officer
- Clinician
- Government Admin
- Super Admin

A user must never be able to select or request a privileged role through public signup.

Role authorization comes from the authenticated user's verified database profile, never from email, URL parameters, frontend state, or hidden inputs.

## Student Flow

`Signup → Profile → Privacy Policy → DPDP Consent → Student Dashboard`

Then:

`Weekly 10-minute Reflection → Private Scoring → Personalized Tasks/Suggestions → Progress`

Students can participate using their real email addresses. The pilot should collect real participation data rather than synthetic assessment records.

## College Structure

Current pilot operates at state level.

Government Admin controls:

`State → Regions → Colleges → Assignments`

Students select an existing college during signup and become associated with that institution.

Target is approximately 50 real students for the pilot, but the architecture should support more.

## College Officer

One faculty member can be provisioned as College Officer.

Capabilities:

- Weekly participation
- Completion tracking
- Branch/department filtering
- Year filtering
- Section filtering
- Institutional insights
- Support-focus identification
- Campus support actions/interventions
- Student support-request handling

Do not use stigmatizing terms such as “affected students”.

Prefer:

- Support Focus
- Institutional Focus
- Participation
- Suggested Action
- Campus Support

### Privacy

Current minimum privacy threshold:

**10 completed reflections**

The threshold must apply **after filtering**.

If a selected branch/year/section has fewer than 10 completed reflections, detailed category analytics must remain suppressed to prevent inference.

## Clinician Model

Two clinicians/counsellors per region.

They are database-provisioned, not public signups.

Workflow:

`Clinician A creates → Clinician B reviews → comments/revision → A revises → B reviews → Regional Officer review`

The workflow must support genuine back-and-forth communication.

Clinicians author/govern:

- Weekly question pools
- Question content
- Supportive recommendation/task content

Clinicians must not receive unnecessary student identity or raw reflection data.

## Regional Officer

Regional Officers are database-provisioned and assigned to a region.

They can:

- Review clinician-approved question pools
- Comment on individual questions
- Request revisions
- Approve/activate question pools
- Oversee assigned colleges
- Monitor permitted aggregate implementation metrics

Question lifecycle:

`Clinician Draft → Peer Review → Regional Review → Approved → Active`

Returned questions can go back through the review cycle.

## Government Admin

Government Admin controls the state-level administrative structure:

- Create/manage colleges
- Create/manage regions
- Assign colleges to regions
- Provision/assign Regional Officers
- View state-level aggregate analytics
- Compare institutions
- Oversee aggregate interventions/actions

## Super Admin

Platform-level administrative role.

Responsibilities include platform configuration, cycles, system-wide question library/configuration and system oversight.

## Weekly Question Model

One reflection approximately every week, around 10 minutes.

Example:

`Week 1 answers → Adaptive selection → Week 2 approved question pool`

Then:

`Week 2 answers → Adaptive selection → Week 3`

Adaptive selection must choose only from clinician/regional-approved content.

## Personalized Student Tasks

After every completed assessment, students receive small supportive tasks/suggestions derived from their actual answers.

The content should originate from clinician-authored/approved material.

Flow:

`Clinician Content → Category/Trigger → Student Signal → Matching Recommendation → Student Task`

No random fake tasks and no fabricated clinical advice.

## Student Support

Student has:

**Contact College Counsellor**

A voluntary support request goes to the College Officer for coordination.

The College Officer receives the support request without automatically receiving the student's complete reflection history or raw reflection text.

Existing crisis support/Tele-MANAS architecture must be preserved and integrated rather than removed.

## Institutional Credit Model

Agreed product model:

`Weekly Participation → Annual Completion → 1 Institutional Academic / Wellness Credit`

This is an institutional participation/completion mechanism, not a clinical score.

## Privacy / DPDP

Preserve existing:

- Privacy consent
- Privacy Policy
- Privacy requests
- Audit logs
- Data processing purposes
- Retention policies
- Consent withdrawal
- Privacy threshold
- Non-clinical framing

Do not duplicate privacy tables or weaken existing protections.

## Existing Completed Work to Preserve

Already completed and should not be unnecessarily rebuilt:

- `12_security_hardening.sql`
- `13_crisis_support.sql`
- `14_clinician_workflow_extras.sql`
- Default-deny role routing
- Profile-based role resolution
- RLS hardening
- Crisis support / Tele-MANAS
- Clinician workflow
- Question authoring and peer review
- Regional question governance
- Adaptive question selection
- Privacy governance
- College analytics
- Government analytics
- Institutional action intelligence
- Intervention lifecycle
- Mobile responsive shell

## Main Product Priorities

1. **Student onboarding**
   - Signup
   - College assignment
   - DPDP consent
   - Clean student profile

2. **Student experience**
   - Weekly reflection
   - Adaptive questions
   - Personalized tasks
   - Progress/history
   - Privacy
   - Counsellor contact
   - Crisis support

3. **Clinician workspace**
   - Question pools
   - Authoring
   - Peer review
   - Revision conversation
   - Recommendation/task authoring
   - Regional handoff

4. **College Officer**
   - Participation
   - Branch/year/section filters
   - Privacy protection
   - Institutional intelligence
   - Support focus
   - Actions/interventions
   - Support requests

5. **Regional Officer**
   - Assigned colleges
   - Question review
   - Question comments
   - Activation
   - Regional oversight

6. **Government Admin**
   - Colleges
   - Regions
   - Officer assignments
   - State analytics
   - Institutional benchmarking

7. **Super Admin**
   - Platform controls
   - Cycle management
   - System configuration

8. **UI polish**
   - Student = mobile-first supportive app
   - Clinician = professional review workspace
   - College = institutional intelligence command center
   - Regional = governance workspace
   - Government = state oversight
   - Super Admin = platform control center

## Judge Demonstration Story

`Student Signup`
→ `Privacy Policy / DPDP Consent`
→ `Week 1 Reflection`
→ `Personalized Tasks`
→ `Real Student Participation`
→ `College Aggregate Intelligence`
→ `Academic Filtering`
→ `Privacy Threshold`
→ `Institutional Focus`
→ `Campus Support Action`
→ `Clinician Question Governance`
→ `Regional Review`
→ `Adaptive Week 2`
→ `Student Support Request`
→ `Government State Overview`

## Critical Rules

1. Only students self-register.
2. All privileged roles are database-provisioned.
3. Student signup always forces `role = student`.
4. Institution assignment must be validated server-side.
5. Never trust role/institution/region query parameters.
6. Never weaken RLS to solve UI problems.
7. Never expose raw student reflection text unnecessarily.
8. Apply privacy thresholds after filtering.
9. Never fabricate analytics or assessment data.
10. Keep institutional language supportive and non-evaluative.
11. Keep service-role credentials server-side only.
12. Preserve existing completed architecture.
13. Do not run destructive SQL.
14. Run tests/build checks after major changes.
15. Do not push to Git until explicitly approved.

## Today's Implementation State

The master operational architecture prompt has been given to Antigravity.

Its reported implementation includes:

- Student self-registration
- Public Privacy Policy
- Regional Officer role
- Regional dashboard
- Regional question governance
- Clinician peer-review workflow
- College academic filters
- Post-filter privacy threshold
- College counsellor support requests
- Role isolation/security hardening

The implementation has **not yet been pushed to Git**.

## Immediate Working Method

After each Antigravity implementation report:

1. Inspect what was actually implemented.
2. Separate completed work from genuine gaps.
3. Do not rebuild completed systems.
4. Choose the next highest-value workstream.
5. Implement it.
6. Run targeted tests.
7. Run `npx astro check`.
8. Run `npm run build`.
9. Review the report before proceeding.
10. Push only after owner approval.

This document is the reference point for today's NSWEIS architecture, decisions, role model, account model, and implementation direction.

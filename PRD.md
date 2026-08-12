# National Student Well-being Early Intervention System (NSWEIS)
## Product Requirements Document (PRD) — Hackathon MVP

**Document Status:** MVP / Build Baseline  
**Version:** 0.1  
**Date:** 2026-08-12  
**Product Owner / Project Manager:** User / Project Team  
**CTO:** ChatGPT  
**Developer:** Antigravity  
**UI/UX:** Google Stitch  
**Frontend:** Astro  
**Backend:** Supabase  
**Database:** Supabase PostgreSQL  
**Deployment:** Vercel

---

# 1. Product Vision

NSWEIS is a privacy-conscious digital platform that enables students to complete short recurring well-being check-ins and helps institutions identify aggregate trends early enough to organize preventive support.

The MVP demonstrates a complete role-based ecosystem:

**Student → Assessment → Personalized Feedback → Aggregate Insights → Institutional Intervention → Government Monitoring**

---

# 2. Product Principles

1. Well-being first.
2. Prevention over reaction.
3. Privacy by design.
4. No diagnosis by the MVP.
5. Aggregation before exposure.
6. Human professionals remain responsible for care.
7. Minimal friction for students.
8. Mobile-first responsive experience.
9. Clear, calm, non-judgmental language.
10. Build only what is needed for the hackathon demo.

---

# 3. Technical Stack

## Frontend

- Astro
- TypeScript
- Component-based UI
- Responsive CSS
- UI generated/prototyped in Google Stitch

## Backend

- Supabase
- Supabase Auth
- PostgreSQL
- Row Level Security
- Storage for permitted future assets/voice-note prototypes

## Deployment

- Vercel

## Development Workflow

Google Stitch  
→ export UI  
→ ZIP imported into Antigravity  
→ Antigravity implements structure  
→ CTO defines architecture, logic, database, security, and acceptance criteria  
→ test locally  
→ Supabase integration  
→ Vercel deployment

---

# 4. MVP Roles

## STUDENT

Routes:

- `/student/dashboard`
- `/student/check-in`
- `/student/check-in/history`
- `/student/wellness`
- `/student/profile`

Capabilities:

- Login
- Logout
- View weekly status
- Start assessment
- Answer MCQs
- Enter descriptive response
- Optional voice-note UI
- Submit assessment
- View calculated summary
- View recommendations
- View previous assessments
- View privacy information

---

## COLLEGE WELLNESS OFFICER

Routes:

- `/college/dashboard`
- `/college/insights`
- `/college/interventions`
- `/college/interventions/new`
- `/college/reports`
- `/college/settings`

Capabilities:

- Login/logout
- View college overview
- View aggregate wellness indicators
- Filter by department/year/cohort
- View category trends
- View participation
- Create wellness intervention/session
- View session attendance
- Mark intervention status
- View aggregate intervention outcomes

Restrictions:

- No normal access to student names.
- No roll-number search.
- No raw student answers.
- No individual wellness score display.

---

## GOVERNMENT / DISTRICT ADMIN

Routes:

- `/admin/dashboard`
- `/admin/institutions`
- `/admin/institutions/[id]`
- `/admin/insights`
- `/admin/interventions`
- `/admin/compliance`

Capabilities:

- View institutions
- View adoption
- View participation
- View aggregate trends
- Compare institutions
- View intervention activity
- View compliance
- Review institution-level analytics

Restrictions:

- No direct student identity access in standard views.
- No raw individual response access.

---

## SUPER ADMIN

Routes:

- `/superadmin/dashboard`
- `/superadmin/users`
- `/superadmin/institutions`
- `/superadmin/questions`
- `/superadmin/settings`

Capabilities:

- Manage demo users
- Manage institutions
- Manage assessment questions
- Manage question categories
- Manage demo configuration
- Review system activity

This role exists primarily for MVP administration.

---

# 5. Authentication Requirements

## Login

Login form:

- Email
- Password

Optional MVP enhancement:

- Demo account selector

Example demo accounts:

- student.demo@example.com
- wellness.demo@example.com
- admin.demo@example.com
- superadmin.demo@example.com

Passwords should be configured through Supabase and not hardcoded into frontend source.

## Logout

Every authenticated dashboard must provide logout.

## Session Handling

Authenticated users must be redirected to their role dashboard.

Unauthenticated users must not access protected routes.

Users attempting to access another role's route must be denied/redirected.

---

# 6. Student Dashboard

The student dashboard should immediately answer:

- How am I doing?
- Have I completed this week's check-in?
- What should I do next?
- What changed recently?

Suggested components:

### Greeting

"Good evening, Alex."

### Weekly Check-in Card

Status:

- Not started
- In progress
- Completed

CTA:

"Start this week's check-in"

### Wellness Snapshot

Display:

- Overall wellness indicator
- Academic pressure
- Emotional balance
- Sleep/rest
- Social connection

Avoid clinical language.

### Recommendation Card

Example:

"Your academic pressure appears higher this week. Consider planning shorter study blocks and taking regular breaks."

### History

Small trend visualization.

### Privacy Notice

"Your personal responses are private. Your college sees aggregated trends."

---

# 7. Assessment Experience

## Step 1 — Introduction

Explain:

- estimated time
- purpose
- privacy
- voluntary descriptive field
- non-diagnostic nature

CTA:

"Begin check-in"

## Step 2 — Questions

Each question displays:

- category
- question
- options
- progress indicator

Example:

"How manageable did your academic workload feel this week?"

Options:

- Very manageable
- Manageable
- Somewhat difficult
- Difficult
- Extremely difficult

## Step 3 — Descriptive Reflection

Prompt:

"Is there anything you would like to share about your week?"

Text input.

## Step 4 — Optional Voice Note

UI:

"Prefer to speak?"

Record / upload control.

For MVP:
store metadata or a permitted demo file; do not implement emotion inference.

## Step 5 — Adaptive Questions

After broad questions, the system selects a limited number of category-specific questions.

Example rule:

If academic_score >= threshold:
show academic follow-up set.

If sleep_score >= threshold:
show sleep follow-up set.

Maximum follow-up questions should be controlled.

## Step 6 — Review

Show:

- number of responses
- categories covered
- privacy reminder

CTA:

"Complete check-in"

## Step 7 — Result

Show:

- Wellness snapshot
- category indicators
- change from previous week
- recommendations
- next check-in date

---

# 8. Assessment Engine

## Question Object

Each question contains:

- id
- text
- type
- category
- options
- scoring map
- weight
- active
- order
- follow-up trigger
- follow-up priority

## Question Types

MVP:

- single choice
- multiple choice
- short text

Future:

- long text
- voice
- scale
- professional screening instrument

---

# 9. Adaptive Logic

Use deterministic logic in MVP.

Pseudo-flow:

```text
Load base questions
        ↓
Collect responses
        ↓
Calculate category scores
        ↓
Identify elevated categories
        ↓
Select follow-up questions
        ↓
Present limited follow-up set
        ↓
Calculate final wellness snapshot
```

Rules must be stored/configurable rather than embedded throughout UI components.

---

# 10. Scoring Model

Every scored response maps to a numerical value.

Example:

1 = low concern
2 = mild
3 = moderate
4 = elevated
5 = high

Category score:

`weighted response total / applicable weight`

Overall score:

weighted combination of category indicators.

The exact weights must remain configurable.

The MVP must not present the score as a medical measurement.

UI wording:

"Wellness indicator"

not

"Psychological diagnosis"

---

# 11. Student Result Page

Required sections:

### Overall Snapshot

A calm visual summary.

### What Changed

Compare current and previous check-in.

### Areas to Pay Attention To

Example:

- Academic pressure
- Sleep/rest

### Suggested Actions

3–5 practical actions.

### Support

Show institutional support options.

### Privacy

Explain what the college sees.

---

# 12. Student History

Display:

- assessment date
- completion status
- wellness indicator
- category trends
- recommendations

Student can open a previous assessment summary.

Raw responses may be shown only to the student.

---

# 13. College Dashboard

Top metrics:

- Total students
- Active this week
- Participation rate
- Interventions this month
- Students reached through interventions

Charts:

- weekly participation
- category distribution
- wellness trend
- department comparison
- intervention activity

Use fictional/demo data.

---

# 14. College Insights

Filters:

- department
- year
- semester
- date range

Metrics:

- academic pressure
- sleep concerns
- social connection
- career concerns
- financial concerns
- family concerns

All insights are aggregate.

Minimum cohort thresholds should be considered for future production to reduce re-identification risk.

---

# 15. College Intervention Management

Create intervention:

Fields:

- title
- description
- category
- target cohort
- date
- time
- location
- facilitator
- capacity
- status

Example:

"Exam Stress & Time Management Workshop"

Category:

Academic Well-being

Target:

CSE — 2nd Year

---

# 16. Intervention Detail

Display:

- title
- objective
- target cohort
- scheduled date
- attendance
- status
- outcome feedback

Statuses:

- Draft
- Scheduled
- Ongoing
- Completed
- Cancelled

---

# 17. Government Dashboard

Top metrics:

- institutions onboarded
- active institutions
- student participation
- intervention activity
- compliance rate

Visualizations:

- institution participation
- district trends
- category trends
- institution comparison
- intervention completion

---

# 18. Government Institution Detail

Display:

- institution profile
- student population
- participation rate
- weekly trend
- category trends
- intervention count
- compliance status

No normal student identity exposure.

---

# 19. Compliance

Institution status:

- Not onboarded
- Onboarding
- Active
- Needs attention
- Compliant

Possible MVP compliance indicators:

- weekly participation
- report generation
- intervention activity
- officer activity

---

# 20. Super Admin

Super admin can manage:

### Users

- create
- deactivate
- assign role
- assign institution

### Institutions

- create
- edit
- deactivate

### Questions

- create
- edit
- categorize
- activate/deactivate

### Configuration

- assessment frequency
- category weights
- thresholds
- demo settings

---

# 21. Database Model

Suggested core tables:

## profiles

- id
- auth_user_id
- full_name
- role
- institution_id
- department_id
- year
- created_at
- updated_at

## institutions

- id
- name
- code
- district
- state
- type
- active
- created_at

## departments

- id
- institution_id
- name
- code

## assessment_cycles

- id
- name
- starts_at
- ends_at
- status

## questions

- id
- text
- question_type
- category
- weight
- active
- order_index

## question_options

- id
- question_id
- label
- score
- value

## assessment_responses

- id
- assessment_id
- question_id
- selected_option_id
- text_response
- created_at

## assessments

- id
- student_id
- cycle_id
- status
- started_at
- completed_at
- overall_indicator
- created_at

## assessment_category_scores

- id
- assessment_id
- category
- score
- band

## recommendations

- id
- category
- title
- description
- priority
- active

## assessment_recommendations

- id
- assessment_id
- recommendation_id

## interventions

- id
- institution_id
- created_by
- title
- description
- category
- target_department_id
- target_year
- scheduled_at
- location
- status

## intervention_attendance

- id
- intervention_id
- student_id
- attended_at

For privacy in the future, attendance and response access policies must be reviewed carefully.

## intervention_feedback

- id
- intervention_id
- rating
- anonymous_comment
- created_at

## audit_logs

- id
- actor_id
- action
- entity_type
- entity_id
- metadata
- created_at

---

# 22. Role-Based Security

Use Supabase Auth + database-level authorization.

Roles should not be trusted solely from frontend state.

Recommended model:

- authenticated user
- profiles table
- role column
- institution relationship
- Row Level Security policies

Frontend guards improve UX.

Database policies provide actual protection.

---

# 23. Privacy Rules

### Student

Can read/write own assessments.

### College Officer

Can read aggregate analytics for their institution.

### Government Admin

Can read permitted aggregate institution analytics.

### Super Admin

Can manage configured demo data.

### Important

Raw student responses must not be exposed through normal institutional analytics queries.

---

# 24. API / Data Access Pattern

Prefer server-side/service-layer functions for sensitive aggregation.

Avoid:

- exposing service-role keys to browser
- direct unrestricted database access
- calculating privileged analytics only in client JavaScript
- trusting client-submitted role values

Use environment variables for secrets.

---

# 25. UI/UX Requirements for Stitch

UI/UX is intentionally separated from this requirements document.

Current design direction:

- white background
- calm mental-wellness aesthetic
- "echo" / soft / reflective visual language
- minimal visual noise
- generous whitespace
- accessible typography
- soft cards
- subtle motion
- clear hierarchy

Color palette is intentionally undecided.

Stitch should focus first on:

- information architecture
- layout
- components
- spacing
- typography hierarchy
- responsive behavior
- interaction states

Color tokens should remain easy to replace later.

---

# 26. Required Stitch Screens

### Public

1. Landing page
2. Login
3. Privacy / How it works

### Student

4. Student dashboard
5. Assessment introduction
6. Assessment question
7. Adaptive follow-up
8. Assessment review
9. Assessment result
10. Assessment history
11. Wellness profile
12. Support/resources

### College

13. College dashboard
14. Insights
15. Intervention list
16. Create intervention
17. Intervention detail
18. Reports

### Government

19. Government dashboard
20. Institutions
21. Institution detail
22. National/district insights
23. Compliance

### Super Admin

24. Admin dashboard
25. Users
26. Institutions
27. Question management
28. Settings

### Shared

29. Profile
30. Notifications
31. Empty states
32. Loading states
33. Error states
34. 404

---

# 27. Design System Requirements

Create reusable components:

- Button
- Input
- Select
- Textarea
- Card
- Modal
- Badge
- Tabs
- Progress bar
- Stepper
- Chart container
- Data table
- Empty state
- Toast
- Alert
- Dropdown
- Avatar
- Navigation
- Sidebar
- Header
- Metric card
- Question card
- Wellness indicator
- Intervention card

Do not duplicate component styles across pages.

---

# 28. Responsive Requirements

Must work on:

- mobile
- tablet
- laptop
- large desktop

Student assessment must be particularly usable on mobile.

Administrative dashboards may use desktop-oriented layouts but must remain responsive.

---

# 29. Accessibility

Minimum MVP requirements:

- semantic HTML
- keyboard navigation
- visible focus states
- readable contrast
- labels for form controls
- descriptive button text
- no color-only information
- accessible error messages

---

# 30. Notifications

MVP:

- in-app notification UI
- assessment reminder UI
- intervention notification UI

Future:

- email
- push notifications
- SMS/WhatsApp where appropriate and legally approved

---

# 31. Demo Data

Seed data should include:

### Institutions

3–5 fictional colleges.

### Departments

CSE, ECE, Mechanical, Civil, etc.

### Students

20–50 demo students.

### Assessments

Multiple weeks of historical data.

### Interventions

Several completed and scheduled sessions.

### Admins

College and government roles.

Historical data should be realistic enough to make charts meaningful.

---

# 32. Demo Scenario

## Scenario A — Student

Login  
→ dashboard  
→ "Complete weekly check-in"  
→ answer questions  
→ adaptive questions appear  
→ submit  
→ result shows elevated academic pressure  
→ recommendations appear  
→ history updates.

## Scenario B — College

Logout  
→ college login  
→ dashboard shows academic pressure trend  
→ open insights  
→ identify CSE second-year academic pressure  
→ create exam-stress workshop  
→ schedule session.

## Scenario C — Government

Logout  
→ government login  
→ dashboard shows multiple institutions  
→ participation comparison  
→ open institution  
→ inspect aggregate trends  
→ verify intervention activity.

---

# 33. Navigation Structure

## Public

`/`

`/login`

`/privacy`

## Student

`/student/dashboard`

`/student/check-in`

`/student/history`

`/student/wellness`

`/student/profile`

## College

`/college/dashboard`

`/college/insights`

`/college/interventions`

`/college/interventions/new`

`/college/reports`

## Government

`/admin/dashboard`

`/admin/institutions`

`/admin/institutions/:id`

`/admin/insights`

`/admin/compliance`

## Super Admin

`/superadmin/dashboard`

`/superadmin/users`

`/superadmin/institutions`

`/superadmin/questions`

`/superadmin/settings`

---

# 34. Functional Acceptance Criteria

## Authentication

- User can log in.
- Invalid credentials show a clear error.
- User can log out.
- Session persists after refresh.
- Protected routes require authentication.
- Role mismatch is rejected.

## Assessment

- Student can start assessment.
- Progress is saved during active session.
- Required questions must be answered.
- Adaptive questions can appear based on earlier responses.
- Assessment can be completed.
- Result is generated.
- History is updated.

## Analytics

- College dashboard loads aggregate data.
- Government dashboard loads institution-level aggregate data.
- Filters work.
- Charts update based on filters.
- No normal analytics view exposes individual student responses.

## Interventions

- Officer can create intervention.
- Intervention appears in list.
- Status can change.
- Attendance can be recorded.
- Dashboard metrics update.

---

# 35. Error Handling

Every major operation must have:

- loading state
- success state
- validation error
- server error
- empty state

Never leave the user staring at a blank screen.

---

# 36. Code Style Requirements for Antigravity

### General

- TypeScript wherever possible.
- Small reusable components.
- Keep business logic out of presentation components.
- Use clear naming.
- Avoid duplicated logic.
- Avoid unnecessary dependencies.
- Keep functions focused.
- Use environment variables for secrets.

### Architecture

Recommended conceptual layers:

```text
src/
  components/
  layouts/
  pages/
  services/
  lib/
  types/
  utils/
  styles/
```

Business logic should live in services/lib rather than being duplicated inside pages.

---

# 37. CTO Architecture Rules

1. Do not rewrite the Stitch UI unnecessarily.
2. Preserve the visual structure unless it conflicts with functionality.
3. Do not hardcode demo data into UI components after database integration.
4. Use seed scripts for demo data.
5. Keep Supabase queries isolated in service modules.
6. Validate form data.
7. Never expose Supabase service-role keys to the browser.
8. Use RLS.
9. Use role checks at the server/database layer.
10. Keep scoring rules configurable.
11. Keep question content data-driven.
12. Keep charts based on real query results.
13. Build P0 before P1.
14. Do not add unrequested features during the hackathon.
15. Fix bugs without changing unrelated functionality.

---

# 38. Environment Variables

Expected categories:

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The service-role key must never be exposed to client-side code.

Actual environment variable names should be finalized during implementation based on the Astro/Supabase integration approach.

---

# 39. Testing Requirements

### Manual

- Login/logout
- Role routing
- Assessment completion
- Adaptive logic
- Result generation
- Dashboard analytics
- Intervention creation
- Responsive layouts

### Database

- RLS policies
- student isolation
- institution isolation
- admin permissions

### Visual

- mobile
- tablet
- desktop
- empty states
- loading states
- long text
- validation errors

---

# 40. Deployment Requirements

Deployment target:

**Vercel**

Database/backend:

**Supabase**

Deployment checklist:

- production environment variables
- Supabase URL
- public anon key
- service role key only where server-side
- database migrations
- seed/demo data
- RLS enabled
- production build passes
- authentication works
- protected routes work
- no secrets committed to Git

---

# 41. MVP Build Order

## Phase 1 — Foundation

- Astro project
- Supabase connection
- auth
- database schema
- role model
- route protection

## Phase 2 — Student

- dashboard
- assessment
- adaptive logic
- scoring
- result
- history

## Phase 3 — College

- dashboard
- insights
- intervention management

## Phase 4 — Government

- dashboard
- institutions
- aggregate analytics
- compliance

## Phase 5 — Admin

- demo management
- questions
- users

## Phase 6 — Polish

- responsive
- animations
- empty states
- loading states
- accessibility
- demo data
- final QA

---

# 42. Hackathon Priority Rule

If time becomes limited:

**Do not reduce the core story. Reduce administrative complexity.**

The essential demo story is:

**Student check-in → personalized result → college insight → intervention → government oversight**

Everything else is secondary.

---

# 43. Definition of Done

The MVP is ready for mentor demonstration when:

- application deploys successfully
- demo users can log in
- role-based dashboards work
- student can complete a weekly check-in
- adaptive questions work
- result is generated
- history works
- college dashboard displays aggregate insights
- officer can create an intervention
- government dashboard displays institution-level analytics
- privacy boundaries are visible
- UI is responsive
- no critical console/runtime errors exist
- demo data makes dashboards meaningful
- the complete flow can be demonstrated in under 10 minutes

---

# 44. Future Product Roadmap

## Version 0.2

- professional question-bank review
- better analytics
- notifications
- multilingual UI
- stronger privacy controls

## Version 0.3

- psychologist portal
- validated assessment instruments
- referral workflow
- professional intervention tracking

## Version 1.0

- institution integrations
- scalable government administration
- advanced analytics
- accessibility expansion
- formal governance and compliance

---

# 45. Final Product Positioning

NSWEIS should be presented as:

> A preventive student well-being infrastructure that connects weekly student self-reflection with privacy-preserving institutional intelligence and timely wellness interventions.

It should not be presented as:

> An AI that diagnoses student mental health.

The first is a policy-support platform.

The second creates unnecessary clinical, ethical, and technical claims.


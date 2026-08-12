# National Student Well-being Early Intervention System (NSWEIS)
## Business Requirements Document (BRD) — Hackathon MVP

**Document Status:** MVP / Demo Baseline  
**Version:** 0.1  
**Date:** 2026-08-12  
**Business Owner / Project Manager:** User / Project Team  
**CTO:** ChatGPT  
**Implementation Developer:** Antigravity  
**UI/UX Prototyping:** Google Stitch  
**Frontend:** Astro  
**Backend & Database:** Supabase  
**Deployment:** Vercel

---

## 1. Executive Business Summary

NSWEIS is a proposed digital student well-being early-intervention platform designed to help educational institutions move from reactive mental-health support toward preventive, data-informed student well-being management.

The MVP demonstrates the complete operating model:

**Student → Weekly Well-being Check-in → Personalized Feedback → Anonymous Institutional Insights → Wellness Intervention → Monitoring**

The product is not intended to diagnose mental illness. It identifies self-reported well-being patterns, provides supportive guidance, and helps authorized institutional/government stakeholders understand aggregate trends.

The hackathon MVP will demonstrate the policy concept through realistic role-based dashboards and demo data rather than attempting to implement a nationwide production system.

---

## 2. Business Problem

Educational institutions often learn about serious student distress only after academic decline, withdrawal, crisis, or another visible event.

Current gaps include:

- Student distress is often self-reported only when severe.
- Students may hesitate to approach counselling services.
- Institutions lack continuous, structured well-being trend data.
- Existing surveys are often periodic, generic, or disconnected from intervention.
- Wellness programs may not be targeted to the actual needs of a cohort.
- Policymakers lack standardized aggregate indicators for student well-being.
- A student can experience a rapidly changing situation between formal counselling interactions.

NSWEIS introduces a lightweight, recurring, structured check-in model that connects assessment with preventive action.

---

## 3. Business Goal

Create a credible, visually polished MVP that allows a mentor/judge to understand within minutes:

1. What the student experiences.
2. How weekly assessments work.
3. How questions adapt to previous responses.
4. How the student receives a non-diagnostic wellness summary.
5. How anonymous aggregate trends appear to a college.
6. How a government/district administrator can monitor institutions.
7. How institutions can respond with targeted wellness sessions.
8. How participation and intervention effectiveness are measured.

---

## 4. Business Objectives

### Primary Objectives

- Demonstrate a complete preventive student well-being workflow.
- Demonstrate role-based access.
- Demonstrate weekly adaptive assessments.
- Demonstrate student-level private feedback.
- Demonstrate institution-level aggregate analytics.
- Demonstrate government/district oversight without exposing student identity in normal dashboards.
- Demonstrate intervention planning and tracking.
- Demonstrate measurable KPIs.
- Establish a foundation that can later be expanded into a real policy implementation.

### Secondary Objectives

- Make the system easy to explain during a live demo.
- Keep the architecture simple enough to build in a few days.
- Avoid unnecessary production complexity in the hackathon phase.
- Preserve a scalable database and role model for future development.

---

## 5. Business Scope

### In Scope for MVP

- Demo authentication.
- Login/logout.
- Role-based access.
- Student dashboard.
- Weekly assessment.
- Multiple-choice questions.
- Descriptive responses.
- Optional voice-note UI placeholder / upload flow.
- Adaptive follow-up questions.
- Wellness scoring.
- Student wellness summary.
- Recommended actions.
- Assessment history.
- College wellness dashboard.
- Aggregate trend analytics.
- Topic distribution.
- Intervention/session management.
- Session participation tracking.
- District/government admin dashboard.
- Institution comparison.
- Institution-level compliance/participation.
- User/profile management for demo users.
- Seed/demo data.
- Responsive web experience.
- Supabase persistence.
- Vercel deployment.

### Out of Scope for MVP

- Clinical diagnosis.
- Automated psychiatric diagnosis.
- Automated medical treatment.
- Autonomous crisis intervention.
- Real government authentication.
- Aadhaar integration.
- Real institutional SSO.
- Real national student database integration.
- Real-time psychologist consultation.
- Payment processing.
- Public student rankings.
- Selling student data.
- Advertising.
- Fully validated clinical screening instruments unless later approved by qualified professionals.
- Nationwide deployment infrastructure.
- Production-grade regulatory certification.

---

## 6. Target Stakeholders

### Primary

- Students
- College Wellness Officers
- Government/District Administrators

### Secondary

- University administrators
- Student affairs teams
- Counsellors
- Psychologists
- Policy makers
- Educational regulators
- Faculty
- Parents/guardians in future phases
- Technology/implementation partners

---

## 7. Business Roles

### Student

Purpose:
Complete recurring well-being check-ins and receive private supportive feedback.

### College Wellness Officer

Purpose:
Understand aggregate student well-being trends and coordinate interventions.

### District/Government Administrator

Purpose:
Monitor participating institutions, adoption, trends, and intervention performance.

### Super Admin

Purpose:
Manage the demonstration environment, institutions, questions, users, and configuration.

### Future Professional Advisor

Psychologist/mental-health professional role is planned for later phases to validate question banks, intervention content, and escalation protocols.

---

## 8. Business Process

### Current-State Problem

Student experiences difficulty  
→ no structured check-in  
→ institution has limited visibility  
→ intervention may occur late.

### Proposed-State Process

Student completes weekly check-in  
→ system evaluates self-reported responses  
→ student receives personal summary  
→ aggregate patterns are calculated  
→ college sees anonymous trends  
→ college conducts targeted intervention  
→ participation/intervention outcomes are measured  
→ next assessment measures change.

---

## 9. Student Participation Model

The policy concept proposes recurring participation supported by institutional academic/student-development mechanisms.

For the MVP:

- Participation status is recorded.
- Completion history is displayed.
- A demo credit/participation indicator is shown.
- The product must clearly label this as a policy-demo mechanism, not an existing government entitlement.

The future policy can define whether participation maps to UHV/NSS/value-added/student-development credits.

---

## 10. Assessment Business Logic

### Frequency

Default: once per week.

### Initial Assessment

The first assessment contains broad questions across:

- Academic pressure
- Sleep/rest
- Emotional state
- Family/home environment
- Relationships/social support
- Financial concerns
- Career uncertainty
- Campus experience
- Physical well-being
- Belonging/isolation
- General stress

### Adaptive Assessment

Future assessments use previous answers to select relevant follow-up questions.

Example:

If academic stress is elevated:
- ask more academic-pressure questions.

If sleep concern increases:
- ask sleep/routine questions.

If family stress increases:
- ask a limited number of family-support questions.

The MVP should use deterministic rules for reliability. AI can be added later.

---

## 11. Business Rules for Scoring

The MVP should use a transparent internal scoring model.

Each question may have:

- category
- weight
- response score
- severity band
- whether it triggers follow-up questions

The system calculates category-level indicators.

Suggested bands:

- Stable
- Watch
- Elevated
- High Support Need

These are wellness-support indicators, not medical diagnoses.

The student-facing language must avoid labels such as "you are depressed" or "you have anxiety."

---

## 12. Intervention Model

The system uses four conceptual support levels:

### Level 1 — Self-support

For stable responses:
- habits
- reflection
- study planning
- sleep hygiene
- wellness resources

### Level 2 — Preventive Activities

For emerging concerns:
- workshops
- peer activities
- wellness resources
- targeted awareness sessions

### Level 3 — Confidential Institutional Support

For sustained elevated concerns:
- encourage contact with a counsellor/wellness professional
- provide institutional support options

### Level 4 — Crisis Protocol

For responses indicating potential immediate danger:
- display urgent support guidance
- direct the student to approved emergency/crisis resources
- follow a separately governed institutional crisis protocol

The MVP should demonstrate the workflow without claiming clinical risk prediction.

---

## 13. Institutional Reporting

The College Wellness Officer receives aggregated insights such as:

- participation rate
- category trends
- cohort trends
- weekly change
- intervention topics
- session attendance
- improvement after interventions

Normal dashboard views must not expose student names, roll numbers, email addresses, or raw private responses.

---

## 14. Government/District Reporting

The government/district dashboard may see:

- institutions onboarded
- participation rates
- aggregate wellness trends
- intervention activity
- institution compliance
- institution comparisons
- geographic/district trends

The MVP should use fictional/demo institutions and data.

---

## 15. Privacy Business Principle

The product follows:

**Collect the minimum data necessary → restrict access → aggregate wherever possible → explain how data is used.**

Student identity and student responses must be separated conceptually from institutional analytics.

The MVP should make the privacy model visible in the UI.

---

## 16. Business Success Criteria

The MVP is successful if a mentor can understand the complete concept without developer explanation.

A successful demo should show:

1. Student logs in.
2. Student completes check-in.
3. System adapts questions.
4. Student receives wellness summary.
5. Student views history.
6. College officer logs in.
7. Officer sees aggregate trends.
8. Officer creates or schedules a wellness session.
9. Government admin logs in.
10. Admin sees institutional adoption and trends.
11. Admin opens an institution and reviews its performance.
12. No normal dashboard exposes student identity.

---

## 17. Business KPIs

### Student KPIs

- Weekly participation rate
- Assessment completion rate
- Returning student rate
- Average completion time
- Wellness trend movement

### Institution KPIs

- Active students
- Participation rate
- Intervention sessions
- Session participation
- Topic coverage
- Improvement trend

### Government KPIs

- Institutions onboarded
- Institution compliance
- District participation
- Overall assessment participation
- Intervention completion
- Trend movement

---

## 18. Business Risks

### Privacy Risk

Mitigation:
Role-based access, aggregation, encryption, explicit privacy messaging.

### Stigma Risk

Mitigation:
Use "well-being" terminology and supportive language.

### False Interpretation

Mitigation:
Clearly state that the platform is not a diagnostic tool.

### Low Student Participation

Mitigation:
Credits/participation mechanisms, reminders, engaging UX, short assessments.

### Institutional Resistance

Mitigation:
Simple dashboards and automated reports.

### AI Bias

Mitigation:
Human review, validated question banks, transparent rules, monitoring.

### Overdependence on AI

Mitigation:
AI assists; humans remain responsible for institutional decisions and professional care.

---

## 19. Future Business Expansion

- Professional psychologist validation.
- Clinically validated questionnaires where appropriate.
- Multilingual support.
- Offline-first support.
- Institutional SSO.
- University integrations.
- Government identity systems where legally appropriate.
- Advanced trend analysis.
- National anonymous well-being index.
- Research dashboard.
- Longitudinal outcomes.
- Professional referral networks.

---

## 20. MVP Prioritization

### P0 — Mandatory

- Authentication
- Student role
- College role
- Government admin role
- Dashboard routing
- Weekly assessment
- Adaptive questions
- Scoring
- Student summary
- Aggregate analytics
- Sessions/interventions
- Demo data
- Supabase persistence
- Responsive UI

### P1 — Important

- Super admin
- Assessment history
- Voice-note UI
- Notifications UI
- Institution comparison
- Export/report UI

### P2 — Future

- Real AI analysis
- Speech emotion analysis
- Professional portal
- Advanced predictive analytics
- Government integrations
- Mobile app

---

## 21. Demo Strategy

The MVP should be designed around a controlled story.

### Demo Account 1

Student with elevated academic stress.

### Demo Account 2

Student with stable well-being.

### Demo Account 3

College Wellness Officer.

### Demo Account 4

District/Government Administrator.

### Demo Account 5

Super Admin.

The team should be able to switch roles quickly and demonstrate the entire ecosystem in 5–8 minutes.

---

## 22. Business Decision

Build the MVP as a **policy demonstration platform**, not as a production mental-health product.

The system should prove the operating model first.

Clinical validation, nationwide compliance, advanced AI, and government integration belong to later phases.


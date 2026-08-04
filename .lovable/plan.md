# MediRoster Differentiation Roadmap

## What makes it different from existing systems
Most hospital scheduling tools are just calendars with approval chains. MediRoster becomes a **predictive workforce co-pilot** by combining:

1. **Fairness-aware auto-scheduling** (already built) — assigns shifts based on workload balance, skills, and fatigue rules rather than manual rotation.
2. **Demand forecasting** (already built) — predicts patient inflow from historical patterns and recommends doctor/nurse ratios.
3. **Ward capacity tracking** — links live bed occupancy to staffing needs.
4. **Burnout prevention** — fatigue scoring, rest-period enforcement, and automated shift caps.
5. **Staff marketplace** — lets staff trade shifts within rules, reducing admin workload.
6. **AI voice/SMS assistant** — shift reminders, emergency broadcasts, and natural-language schedule queries.
7. **Compliance reporting** — audit trails, CPD tracking, and payroll-ready exports.

## Completed
- Phase 1: Smart Scheduling — fairness scoring, skills-based assignment, auto-generation.
- Phase 2: Predictive Inflow — AI-lite demand forecast, recommended staffing, actual-inflow recording.

## Phase 3: Live Ward Capacity Tracker
- Add a `beds`/`wards` table with occupancy, acuity, and isolation flags.
- Admin dashboard shows a color-coded ward map: available, occupied, cleaning, high-acuity.
- Update the Demand Forecast widget to factor in bed occupancy, not just historical inflow.
- Add alerts when a ward is over capacity or understaffed for its acuity mix.

## Phase 4: Burnout Prevention & Staff Marketplace
- Build a fatigue score per staff member from consecutive shifts, night shifts, and total hours.
- Add shift caps and minimum rest-period rules (e.g., 11 hours between shifts).
- Create a swap marketplace where doctors/nurses can offer swaps; the system auto-checks skills and rest rules before admin approval.
- Admin dashboard highlights high-risk staff and blocks unsafe assignments.

## Phase 5: AI Voice & SMS Assistant
- Add an integration for SMS/WhatsApp reminders (Twilio/Vonage) for upcoming shifts and appointments.
- Allow emergency broadcast from the admin dashboard ("All ER staff report immediately").
- Add a simple chat/widget for natural-language queries: "Who is on duty tonight in Surgery?"

## Phase 6: Compliance & Accreditation Reports
- Audit trail for every shift change, swap, and approval.
- Weekly/monthly working-hours reports per staff member.
- CPD and skill-expiry tracking.
- Export to CSV/PDF for HR and payroll systems.

## Recommended next step
Implement **Phase 3: Live Ward Capacity Tracker** because it directly builds on the demand forecast already in the dashboard and gives admins a real-time operational view that most scheduling systems lack.

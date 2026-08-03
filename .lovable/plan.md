# MediRoster Differentiation Plan

## Goal
Transform MediRoster from a standard hospital duty-roster system into a next-generation healthcare workforce platform that no existing competitor offers in a single, integrated package.

## What makes this different

### Phase 1 — Smart Scheduling Engine (in progress)
A fairness-aware, rule-based scheduler that generates duty rosters in seconds while respecting skills, availability, fatigue rules, and workload balance.

**Features to add / complete**
- [x] Core scheduling engine with scoring, fairness metrics, and rule violation detection
- [x] Skills & skill requirements management
- [x] Staff availability calendar
- [ ] Complete the dashboard fairness widget
- [ ] Seed or default sample staff skills so the auto-scheduler produces real shifts out of the box
- [ ] Skill-based visual conflict indicators in the roster
- [ ] One-click "rebalance" button that re-optimizes a selected week for fairness
- [ ] Shift coverage heatmap (red/yellow/green by day/period)

### Phase 2 — AI-Powered Operational Intelligence
Use internal data and optional external signals to predict demand before it happens.

**Features to add**
- Patient inflow predictor: estimate daily/period patient arrivals based on historical appointments, day-of-week, season, and nearby public events
- Auto-suggested staffing: recommend how many doctors/nurses per shift based on predicted demand
- Bed/ward capacity widget: show current occupancy and projected bottlenecks
- Wait-time estimator: live estimated wait time for OPD/ER appointments

### Phase 3 — Staff-Centric Experience
Make the system feel like it works *for* staff, not just managers.

**Features to add**
- Voice-activated shift swap requests (record reason and proposed swap via voice)
- Mobile PWA with push notifications for shift reminders, swap approvals, and fatigue alerts
- Burnout/wellness score: track consecutive nights, long stretches, and weekend coverage per staff
- Automatic fatigue break suggestions after consecutive heavy weeks
- Staff preference learning: system learns preferred shifts over time and weights them
- Instant shift-swap marketplace: staff can post shifts for swap; others pick up; admin just approves

### Phase 4 — Patient & Care Coordination Features
Bridge the gap between rostering and actual patient care.

**Features to add**
- Doctor on-duty status for patient booking (already started)
- QR code check-in at wards/OPD so patients confirm arrival and staff can see live queue
- Family/caregiver appointment updates via WhatsApp/SMS/email
- Telemedicine link auto-generation for remote appointments
- Post-appointment follow-up scheduling tied to the same doctor

### Phase 5 — Ecosystem & Integrations
Connect the platform to the broader hospital and financial system.

**Features to add**
- Payroll integration: export approved shifts/hours to payroll CSV/API
- HRIS sync for staff master data, onboarding, and offboarding
- IoT/device integration: badge-swipe attendance, bed sensors, smart lockers
- Open API for third-party apps (lab, pharmacy, radiology) to read on-duty staff
- Compliance & audit logs: export schedule history for accreditation

## Suggested priority order

1. Finish Phase 1 fairness widget and sample skill data
2. Add a patient wait-time predictor (Phase 2) — high visible value, low data needs
3. Add burnout/wellness tracking (Phase 3) — strong staff-retention story
4. Add QR check-in (Phase 4) — improves patient flow and reduces front-desk load
5. Add payroll export (Phase 5) — makes the system financially relevant

## Technical notes
- All new features should reuse the existing Supabase/Lovable Cloud backend
- Prefer `createServerFn` for app logic; use `src/routes/api/public/*` only for external webhooks
- Keep the UI within the existing medical design system (blue/teal tones, card-based layout)

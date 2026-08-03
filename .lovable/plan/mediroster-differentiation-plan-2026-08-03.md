# MediRoster Differentiation Plan

## Goal

Make MediRoster a distinct hospital workforce platform by combining intelligent scheduling, real-time operational awareness, and staff-patient experience features that go beyond the standard roster/appointment model found in most products today.

## Current Baseline

- Role-based auth with admin approval for staff accounts.
- Monthly roster calendar with color-coded shift types.
- Auto-generate repeating shifts from a staff pool.
- Shift swap / leave requests with admin approval.
- Patient appointment booking only when a doctor is on duty.
- Staff profile pictures, CSV/PDF exports, admin user management.

## Differentiation Pillars

1. **Intelligent Workforce Optimization** — scheduling that considers fairness, fatigue, and skill matching.
2. **Real-Time Hospital Operations** — connect scheduling with bed capacity, ward demand, and patient flow.
3. **Predictive Patient Experience** — use historical data to anticipate wait times and no-shows.
4. **Staff Marketplace & Wellness** — empower staff to trade shifts while protecting their health and compliance.
5. **Connected Care Coordination** — tie appointments, handoffs, and telemedicine to the roster.

## Proposed Feature Roadmap

### Phase 1 — Smart Scheduling Engine

1. **Fairness & Fatigue-Aware Auto-Scheduling**
   - Track night shifts, weekends, and consecutive days per staff member.
   - Score and optimize schedules so burden is distributed evenly.
   - Flag schedules that violate custom rules (e.g., max 4 nights/month, min 12 hours rest).

2. **Staff Availability & Preferences**
   - Let staff mark preferred, unavailable, and desired days in a personal calendar.
   - Auto-scheduler respects preferences while still covering all shifts.
   - Admin can see preference conflicts before publishing the roster.

3. **Skill-Based Assignment**
   - Add skills/certs to staff profiles (e.g., ICU, pediatrics, anesthesia, ACLS).
   - Require matching skills for surgery/ER/ICU shifts.
   - Show skill gaps before generating the roster.

### Phase 2 — Operational Intelligence

4. **Live Ward & Bed Capacity Dashboard**
   - Admins see current occupancy and nurse-to-patient ratios per ward.
   - Recommend additional staff when a ward is over capacity.
   - Link bed capacity to shift demand so the roster adapts to busier days.

5. **Predictive Appointment Demand**
   - Analyze historical appointments to predict busy days and peak hours.
   - Suggest adding more OPD/ward shifts before predicted surges.
   - Show doctors expected patient load for their shift.

6. **Patient Wait-Time & No-Show Prediction**
   - Estimate wait times based on current appointments, doctor duty, and historical no-show rates.
   - Patients see estimated wait time when booking and on arrival.
   - Enable automatic overbooking protection during high no-show windows.

### Phase 3 — Staff Experience & Marketplace

7. **Shift Marketplace with Intelligent Matching**
   - Staff can post a shift they want to swap; others can pick it up if they have the right role/skills.
   - System checks compliance rules before approving a swap.
   - Admin gets a one-click approve/reject for the matched swap.

8. **Wellness & Burnout Score**
   - Personal dashboard shows workload score, night shift load, and rest hours.
   - Admin team view flags staff approaching burnout thresholds.
   - Suggest time off or lighter rotations for high-risk staff.

9. **Credential & Compliance Tracking**
   - Store license and certification expiry dates.
   - Warn admins and staff 30/60/90 days before expiration.
   - Prevent staff from being assigned shifts they are not certified for.

### Phase 4 — Patient & Care Coordination

10. **Telemedicine Slot Support**
    - Mark appointments as in-person or virtual.
    - Only show virtual slots for doctors with the right setup/shift type.
    - Track virtual vs. in-person utilization.

11. **Structured Shift Handoff Notes**
    - Staff can record handoff notes before ending a shift.
    - Next-shift staff see flagged patients, tasks, and warnings.
    - Admins can review handoff completeness.

12. **QR Code Check-In & Patient Flow**
    - Patients receive a QR code after booking.
    - Kiosk or reception scans the code to mark arrival.
    - Updates live queue and notifies the assigned doctor.

13. **Outcome & Satisfaction Loop**
    - After an appointment, patient gives a quick rating.
    - Correlate satisfaction with doctor/staff assignments and shift timing.
    - Identify patterns such as lower ratings after long night shifts.

### Phase 5 — Platform & Ecosystem

14. **Mobile-First PWA**
    - Push notifications for upcoming shifts, swap approvals, and patient arrivals.
    - Staff can view roster, request leave, and accept swaps from their phone.
    - Offline mode for viewing the current roster.

15. **Payroll & Cost Integration**
    - Calculate shift cost, overtime, and night/weekend differentials.
    - Export payroll-ready reports by department and pay period.
    - Estimate labor cost before publishing the roster.

16. **Multi-Location & Department Management**
    - Schedule across multiple clinics, wards, or hospital buildings.
    - Staff can be assigned to a primary department and float to others.
    - Location-aware dashboard shows coverage per site.

## Recommended First Build

Start with Phase 1 because it is technically feasible with the current schema, provides immediate differentiation, and can be built incrementally:

- Add `availability`, `staff_skills`, and `shift_rules` tables.
- Extend the auto-scheduler to read availability, skills, and fairness constraints.
- Add a "Fairness Score" and rule-violation report to the admin dashboard.

Once Phase 1 is proven, add Phase 2 dashboards (ward capacity, predictive demand) and Phase 3 marketplace features.

## Technical Notes

- Keep using Supabase tables, RLS policies, and `createServerFn` for backend logic.
- Add database functions for scheduling optimization where complex logic is needed.
- Preserve the existing role-based UI; add new routes/pages under `/_authenticated`.
- Use existing `recharts` dependency for workload and prediction charts.

## Success Metrics

- Reduce time to publish a monthly roster by 50%.
- Staff report better shift fairness via in-app feedback.
- Fewer uncovered shifts due to skill-aware assignment.
- Lower patient no-show rate and average wait time after predictions are used.

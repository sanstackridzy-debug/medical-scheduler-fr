# DutyFlow Health

Build a full-stack Medical Duties Scheduling System web app.

Goal: Help hospitals/clinics schedule doctors, nurses, and staff duties, and manage patient appointments.

User Roles & Access:
1. Admin/Scheduler: Create users, create duty rosters, assign shifts, view all schedules, export to PDF/CSV
2. Doctor: View personal duty schedule, request shift swap, view patient appointments, mark duty as completed
3. Nurse: View personal duty schedule, request shift swap, view assigned ward/room duties
4. Patient: Book appointment, view appointment history, cancel/reschedule

Core Features:
1. Auth: Email + Password login with Supabase Auth. Role-based access control.
2. Duty Roster: Monthly calendar view. Admin can create shifts: Morning 8am-2pm, Afternoon 2pm-8pm, Night 8pm-8am. Assign multiple staff to one shift. Prevent double-booking.
3. Shift Types: On-call, Ward Duty, OPD, Surgery, ER. Color code each type.
4. Appointment Scheduling: Patients can pick available doctor + date + 30min time slot. Show only slots not conflicting with doctor's duty.
5. Notifications: Email reminder to staff 12hrs before duty. Email/SMS reminder to patient 24hrs before appointment.
6. Requests: Staff can request "Shift Swap" or "Leave". Admin approves/rejects.
7. Dashboard: 
- Admin: "Today's duties", "Staff on duty now", "Pending swap requests"
- Doctor/Nurse: "My upcoming duties", "My appointments"
8. Reports: Export monthly duty schedule and appointment list to PDF and CSV.
9. UI: Clean, professional medical UI with Tailwind. Use cards, tables, and a big monthly calendar. Mobile responsive. Add hospital logo placeholder.
10. Database: Use Supabase. Tables: users, roles, shifts, duties, appointments, swap_requests, notifications.

Extra Requirements:
- Add conflict detection: Don't allow assigning a staff to 2 duties at the same time.
- Add "On-call" badge for staff currently on duty.
- Use a modern, clean, accessible design. Soft blue and white medical theme.

Deploy it with sample data: 2 Admins, 5 Doctors, 10 Nurses, 3 specialties.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mediflooooooooooooooooooooooooooooo.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7dc9e383-eba0-4acc-ba78-889522cf63b9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

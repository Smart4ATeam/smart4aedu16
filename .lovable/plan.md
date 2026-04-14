

## Plan: Unify All Point Operations to `reg_members.points` + `reg_point_transactions`

### Problem

The system has a dual point system:
- **`profiles.total_points`** — updated by database triggers (task approval, quiz pass, attendance) and manually via EditDataDialog
- **`reg_members.points`** — updated by `sync_member_points` trigger from `reg_point_transactions`

Per your directive, **all points should come from `reg_members.points`** managed through `reg_point_transactions`. The `profiles.total_points` field and its related triggers are now stale/conflicting sources.

### Affected Areas

**Database triggers that write to `profiles.total_points` (need removal or redirection):**
1. `on_task_application_approved` — adds task amount to `profiles.total_points`
2. `on_quiz_passed` — adds 20 to `profiles.total_points`
3. `on_attendance_recorded` — adds 10 to `profiles.total_points`
4. `check_and_grant_achievements` — reads `profiles.total_points` for the "百分先鋒" badge check

**Frontend code reading `profiles.total_points`:**
1. `Dashboard.tsx` — already uses `memberPoints` from `reg_members`, but still fetches `total_points` from profiles (minor cleanup)
2. `AdminStudents.tsx` — Platform Users table displays `p.total_points` from profiles
3. `StudentDetailDialog.tsx` — shows `detail.profile.total_points`
4. `EditDataDialog.tsx` — allows manual editing of `profiles.total_points`
5. `AdminDashboard.tsx` — fetches `total_points` from profiles (already uses `member_points` for display)

### Implementation Steps

#### Step 1: Database Migration — Remove/Redirect Triggers
- **Drop or replace** `on_task_application_approved`: Instead of updating `profiles.total_points`, insert a row into `reg_point_transactions` (requires finding the member_id for the user)
- **Drop or replace** `on_quiz_passed`: Same — insert into `reg_point_transactions` instead
- **Drop or replace** `on_attendance_recorded`: Same pattern
- **Update** `check_and_grant_achievements`: Read from `reg_members.points` instead of `profiles.total_points`

#### Step 2: Update Admin Student List (`AdminStudents.tsx`)
- In the Platform Users tab, replace `p.total_points` display with a lookup from `reg_members` (similar to what AdminDashboard already does)

#### Step 3: Update Student Detail Dialog (`StudentDetailDialog.tsx`)
- Change "積分" display to show `reg_members.points` instead of `profile.total_points`

#### Step 4: Update Edit Data Dialog (`EditDataDialog.tsx`)
- Remove the "積分" (`total_points`) field from this dialog since points should only be managed through the Points management tab (which uses `reg_point_transactions`)
- Keep badges, learning days, and revenue fields

#### Step 5: Update Dashboard (`Dashboard.tsx`)
- Remove the unused `total_points` from the profiles fetch (cosmetic cleanup, already displays `memberPoints`)

#### Step 6: Update AdminDashboard (`AdminDashboard.tsx`)
- Remove `total_points` from profiles fetch (already uses `member_points` from reg_members)

### Technical Notes
- The triggers for task/quiz/attendance need to resolve `user_id → member_id` via `reg_members.user_id`. If a user has no `reg_members` record, the point award will be skipped (or we can auto-create a transaction note).
- The `sync_member_points` trigger on `reg_point_transactions` will automatically keep `reg_members.points` in sync.
- The `check_and_grant_achievements` function will need to join `reg_members` to get the user's points.


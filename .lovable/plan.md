

## Plan: Registration System UI Enhancements (4 Issues)

### Issue 1: Reg Members Tab - Edit, Courses, Phone Fix
**Problem**: Members list is read-only, doesn't show courses taken, and phone numbers are missing leading zeros.

**Changes in `src/pages/admin/AdminStudents.tsx`**:
- Add an edit dialog for reg_members (name, phone, email, notes)
- Query `reg_enrollments` for each member to show their enrolled courses
- Add a member detail dialog showing: editable fields + course list
- Phone display: no code change needed for display, but add a note about data quality (the missing `0` is a data issue from import, not a display bug)

### Issue 2: Order Detail - Missing P2/P3 Info & Course List
**Problem**: The `RegOrder` type is missing `p2_phone`, `p2_email`, `p3_phone`, `p3_email`. The order detail dialog doesn't show courses.

**Changes in `src/components/admin/RegistrationTabs.tsx`**:
- Add missing fields to `RegOrder` type: `p2_phone`, `p2_email`, `p3_phone`, `p3_email`, `session_dates`, `is_retrain`, `referrer`, `person_count`, `tax_id`
- Update order detail dialog to show all persons' phone and email
- Add a "報名課程" section using `course_snapshot` data to list courses with prices and session dates

### Issue 3: Enrollment List - Date Filter, Email/Phone, Notes
**Problem**: No session date filter, no email/phone columns, no notes column.

**Changes in `src/components/admin/RegistrationTabs.tsx`**:
- Add a session date dropdown filter (extract unique dates from enrollments)
- Add Email and Phone columns (from `reg_members` join data, already fetched)
- Add Notes column showing `e.notes`
- Update table column count accordingly

### Issue 4: Reg Members Phone Data Fix
**Problem**: Many phone numbers are missing the leading `0` (e.g., `912345678` instead of `0912345678`).

**Action**: Run a SQL update to prepend `0` to 9-digit phone numbers in `reg_members` that look like mobile numbers (starting with `9`). This is a data fix via the insert tool.

---

### Technical Details

**Files to modify**:
1. `src/components/admin/RegistrationTabs.tsx` - OrdersTab (type + detail dialog + course list), EnrollmentsTab (date filter + new columns)
2. `src/pages/admin/AdminStudents.tsx` - RegMembersTab (edit dialog + course history)
3. Database data fix for phone numbers

**Estimated scope**: ~4 focused changes across 2 files + 1 data fix.


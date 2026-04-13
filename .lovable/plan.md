

# Plan: Order Detail Editable Fields + Cascading Person Updates

## What changes

### 1. Show paid_at timestamp in order detail dialog
Add a row displaying `paid_at` formatted as date+time in the order detail grid (currently only shown in the table list, not in the detail dialog).

### 2. Make invoice & person fields editable in order detail
Convert the following read-only fields into editable inputs inside the order detail dialog:

- **Invoice title** (`invoice_title`)
- **Tax ID** (`tax_id`)
- **Person 1-3 name/phone/email** (`p1_name`, `p1_phone`, `p1_email`, etc.)

Add a "Save Changes" button that:
1. Updates `reg_orders` with the changed fields
2. Logs the change to `reg_operation_logs`

### 3. Cascade person changes to reg_enrollments (for paid orders)
When a person's info (name/phone/email) is modified on a paid order:

1. Query `reg_enrollments` joined with `reg_members` for that `order_id`
2. For each changed person (matched by original name), find the corresponding `reg_members` record linked through the enrollment
3. Update the `reg_members` record's name/phone/email to match the new values
4. Log the cascading update to `reg_operation_logs`

This ensures that when an order has already been split (paid → enrollments created → members created), editing person info on the order propagates to the member records.

## Files to modify

- **`src/components/admin/RegistrationTabs.tsx`** — Add edit state for invoice_title, tax_id, p1-p3 fields; add paid_at display; add save mutation with cascading logic

## Technical details

- The cascade logic matches persons by their **original name** (before edit) against `reg_members.name` where the member is linked through `reg_enrollments.order_id = order.id`
- All updates use the existing `supabase` client with admin RLS policies (admin users already have ALL access on both `reg_orders` and `reg_members`)
- The dialog will use controlled `Input` components with local state, initialized when opening the detail
- A single "Save" button handles both invoice field and person field changes together


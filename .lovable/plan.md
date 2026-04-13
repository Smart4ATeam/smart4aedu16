

# Plan: Real-time Updates for Trial Status and Message Notifications

## Problem
1. **My Trials tab** -- When the callback API updates a trial's `api_key` and `webhook_status`, the Resources page doesn't reflect changes until manual refresh.
2. **Message center notification** -- New system messages are created but there's no unread indicator on the sidebar nav, so users don't know they have new messages.

## Solution

### 1. Real-time subscription on `resource_trials` table (Resources.tsx)

Add a Supabase Realtime channel in the `useEffect` that fetches trials. Listen for `UPDATE` events on `resource_trials` filtered by the current user. When a change arrives, update the `trials` state in-place.

**File:** `src/pages/Resources.tsx`
- After the initial `fetchTrials()` call, subscribe to `postgres_changes` on `resource_trials` for `UPDATE` events filtered by `user_id`.
- On payload, replace the matching trial in state (or re-fetch all).
- Cleanup: remove channel on unmount.

**Database:** Enable Realtime on `resource_trials`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE resource_trials;
```

### 2. Unread message badge on sidebar (AppSidebar.tsx)

Add a real-time unread count next to the "訊息中心" nav item.

**File:** `src/components/AppSidebar.tsx`
- Query `conversation_participants` where `user_id = auth.uid()` and `unread = true`, get count.
- Subscribe to `postgres_changes` on `conversation_participants` for real-time updates.
- Display a small red dot or count badge next to the "訊息中心" menu item when unread > 0.

**Database:** Enable Realtime on `conversation_participants`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
```

### 3. Real-time subscription on Messages page (Messages.tsx)

The Messages page already has a real-time subscription for new messages in the selected conversation. Add an additional subscription for `conversation_participants` changes (new conversations appearing, unread status changes) so the conversation list updates automatically when a new system notification arrives.

**File:** `src/pages/Messages.tsx`
- Add a channel listening for `INSERT` on `conversation_participants` filtered by `user_id`.
- On new participant record, re-fetch conversations to show the new notification.

## Technical Details

- **Migration:** One migration to add both tables to `supabase_realtime` publication.
- **Frontend changes:** 3 files modified (`Resources.tsx`, `AppSidebar.tsx`, `Messages.tsx`).
- All subscriptions cleaned up on component unmount via `supabase.removeChannel()`.


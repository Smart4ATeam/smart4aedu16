-- Allow admins to view all profiles for the admin dashboard
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to manage all calendar events (INSERT)
CREATE POLICY "Admins can insert events"
ON public.calendar_events
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow admins to manage conversation_participants
CREATE POLICY "Admins can insert participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow admins to manage conversations
CREATE POLICY "Admins can manage conversations"
ON public.conversations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

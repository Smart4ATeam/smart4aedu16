
-- Remove the ALL policy that gives admins SELECT on all events
DROP POLICY "Admins can manage all events" ON public.calendar_events;

-- Re-add admin powers for INSERT, UPDATE, DELETE only (not SELECT)
CREATE POLICY "Admins can update all events"
ON public.calendar_events FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete all events"
ON public.calendar_events FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

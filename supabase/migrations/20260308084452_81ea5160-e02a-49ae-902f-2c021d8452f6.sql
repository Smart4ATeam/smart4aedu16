-- Allow admins to view all user learning progress
CREATE POLICY "Admins can view all learning progress"
ON public.user_learning_progress
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to delete user roles (for role changes)
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));
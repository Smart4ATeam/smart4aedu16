CREATE POLICY "Users can update own applications"
ON public.task_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
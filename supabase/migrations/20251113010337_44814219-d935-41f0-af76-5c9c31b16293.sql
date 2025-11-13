-- Fix fee_config RLS policy to restrict access to admins only
DROP POLICY IF EXISTS "Everyone can view active fee config" ON fee_config;

CREATE POLICY "Admins can view fee config"
ON fee_config FOR SELECT
USING (has_role(auth.uid(), 'admin'));
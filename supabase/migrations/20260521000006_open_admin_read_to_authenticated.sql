-- Allow all authenticated users to read admin portal data.
-- Write operations (UPDATE) remain ADMIN-only.

-- partnership_registrations: open SELECT to any logged-in user
DROP POLICY IF EXISTS "admins can select" ON public.partnership_registrations;
CREATE POLICY "authenticated can select"
  ON public.partnership_registrations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- contact_submissions: open SELECT to any logged-in user
DROP POLICY IF EXISTS "Admins can view" ON public.contact_submissions;
CREATE POLICY "authenticated can view"
  ON public.contact_submissions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- organizations: open SELECT to any logged-in user (admin list needs all rows)
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
CREATE POLICY "authenticated can view organizations"
  ON public.organizations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- credit_transactions: split the "own rows" FOR ALL into per-operation policies
-- so SELECT is open to all authenticated users (admin dashboard aggregate count)
-- while INSERT/UPDATE/DELETE remain own-user only.
DROP POLICY IF EXISTS "own rows" ON public.credit_transactions;
CREATE POLICY "authenticated can select transactions"
  ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "own rows insert" ON public.credit_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rows update" ON public.credit_transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own rows delete" ON public.credit_transactions
  FOR DELETE USING (auth.uid() = user_id);

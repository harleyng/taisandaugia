-- Admin "Quản lý người dùng" module — server-side backing for the admin user
-- management surface, plus the fix that turns account ACTIVATION into a real DB
-- field (previously it lived only in browser localStorage, so the activation
-- popup reappeared on every login / new device even after topping up).
--
-- Three things:
--   1. profiles gets `activated`/`activated_at` (real source of truth for the
--      "nạp lần đầu để kích hoạt" gate) and `status` (mirror of the GoTrue ban
--      state so the admin list can render "Bị khóa" without reading auth.users).
--   2. Admin SELECT RLS on the credit/role/unlock tables so an ADMIN can read
--      another user's balance/role/unlocks (the "own rows" policies stay intact).
--   3. admin_grant_credits() — the ONLY way to gift credits cross-user, since
--      user_credits/credit_transactions writes are own-rows. SECURITY DEFINER +
--      has_role('ADMIN') guard, mirroring resolve_campaign_audience.

-- ─── 1. Activation + lock columns on profiles ────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activated    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'active';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'locked'));
  END IF;
END $$;

-- Backfill: anyone who already topped up (balance > 0 or a real purchase) is
-- already activated — this heals existing accounts (incl. the reported bug).
UPDATE public.profiles p
   SET activated = true,
       activated_at = COALESCE(p.activated_at, now())
 WHERE p.activated = false
   AND (
     EXISTS (SELECT 1 FROM public.user_credits uc
              WHERE uc.user_id = p.id AND uc.balance > 0)
     OR EXISTS (SELECT 1 FROM public.credit_transactions ct
                 WHERE ct.user_id = p.id AND ct.type = 'purchase' AND ct.credit_delta > 0)
   );

-- ─── 2. Admin read RLS on cross-user tables ──────────────────────────────────
-- Separate SELECT policy per table; the existing "own rows" policies remain.
-- (profiles already has "Admins can view all profiles"; credit_transactions
-- SELECT is already open to authenticated.)

DROP POLICY IF EXISTS "user_credits_admin_read" ON public.user_credits;
CREATE POLICY "user_credits_admin_read" ON public.user_credits
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "user_roles_admin_read" ON public.user_roles;
CREATE POLICY "user_roles_admin_read" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "user_asset_unlocks_admin_read" ON public.user_asset_unlocks;
CREATE POLICY "user_asset_unlocks_admin_read" ON public.user_asset_unlocks
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "user_company_unlocks_admin_read" ON public.user_company_unlocks;
CREATE POLICY "user_company_unlocks_admin_read" ON public.user_company_unlocks
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "user_owner_unlocks_admin_read" ON public.user_owner_unlocks;
CREATE POLICY "user_owner_unlocks_admin_read" ON public.user_owner_unlocks
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "user_report_unlocks_admin_read" ON public.user_report_unlocks;
CREATE POLICY "user_report_unlocks_admin_read" ON public.user_report_unlocks
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 3. admin_grant_credits — gift credits cross-user (admin only) ────────────
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  _user_id UUID,
  _amount  INT,
  _note    TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  INSERT INTO public.user_credits (user_id, balance, updated_at)
  VALUES (_user_id, _amount, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_credits.balance + _amount,
        updated_at = now()
  RETURNING balance INTO new_balance;

  INSERT INTO public.credit_transactions (user_id, type, description, credit_delta)
  VALUES (
    _user_id,
    'admin_grant',
    COALESCE(NULLIF(btrim(_note), ''), 'Admin tặng ' || _amount || ' tín dụng'),
    _amount
  );

  RETURN new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_credits(UUID, INT, TEXT) TO authenticated;

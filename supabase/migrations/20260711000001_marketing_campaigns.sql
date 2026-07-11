-- Marketing / Email Marketing: campaign management + recipient snapshot.
-- Admin-only (back-office) data. Audience resolution runs through SECURITY DEFINER
-- RPCs so admins can segment across RLS-protected tables (user_credits, org tables)
-- without widening those tables' row-level policies.

-- ─── marketing_campaigns ─────────────────────────────────────────────────────

CREATE TABLE public.marketing_campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         TEXT        NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  name            TEXT        NOT NULL,
  notes           TEXT,
  status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'ended')),
  subject         TEXT,
  preview_text    TEXT,
  content_html    TEXT,
  cta_label       TEXT,
  cta_url         TEXT,
  audience_spec   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  respect_optin   BOOLEAN     NOT NULL DEFAULT true,
  schedule_type   TEXT        NOT NULL DEFAULT 'immediate' CHECK (schedule_type IN ('immediate', 'scheduled')),
  scheduled_at    TIMESTAMPTZ,
  eligible_count  INTEGER,
  recipient_count INTEGER     NOT NULL DEFAULT 0,
  sent_count      INTEGER     NOT NULL DEFAULT 0,
  opened_count    INTEGER     NOT NULL DEFAULT 0,
  clicked_count   INTEGER     NOT NULL DEFAULT 0,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_campaigns_status_created ON public.marketing_campaigns (status, created_at DESC);
CREATE INDEX idx_marketing_campaigns_created_by     ON public.marketing_campaigns (created_by);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_campaigns_admin_all"
  ON public.marketing_campaigns FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE TRIGGER marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── campaign_recipients (snapshot taken at send time) ───────────────────────

CREATE TABLE public.campaign_recipients (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID        NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  email       TEXT        NOT NULL,
  name        TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sent', 'failed', 'opened', 'clicked')),
  sent_at     TIMESTAMPTZ,
  opened_at   TIMESTAMPTZ,
  clicked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campaign_recipients_campaign_user_unique  UNIQUE (campaign_id, user_id),
  CONSTRAINT campaign_recipients_campaign_email_unique UNIQUE (campaign_id, email)
);

CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients (campaign_id);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_recipients_admin_all"
  ON public.campaign_recipients FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── Audience resolution (SECURITY DEFINER; admin-guarded) ───────────────────
-- _spec shape:
--   { "modes": {"criteria":bool,"import":bool,"specific":bool},
--     "criteria": { "registration": {"from":date,"to":date}|null,
--                   "accountTypes": ["buyer","company_rep","owner_individual","owner_org","admin"],
--                   "kycStatuses": ["NOT_APPLIED","PENDING_KYC","APPROVED","REJECTED"],
--                   "credit": {"min":num|null,"max":num|null}|null,
--                   "provinces": ["Hà Nội",...], "includeNullProvince": bool },
--     "userIds": [uuid,...], "emails": ["a@b.com",...] }
-- Audience = (criteria match when modes.criteria) ∪ profiles(userIds) ∪ profiles(email ∈ emails),
-- then filtered by notifications_enabled when _respect_optin. Returns each matching user once;
-- total_count carries the full match count on every returned row (window over pre-LIMIT set).

CREATE OR REPLACE FUNCTION public.resolve_campaign_audience(
  _spec          JSONB,
  _respect_optin BOOLEAN DEFAULT true,
  _limit         INT     DEFAULT NULL,
  _offset        INT     DEFAULT 0
)
RETURNS TABLE(user_id UUID, email TEXT, name TEXT, total_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c        JSONB   := COALESCE(_spec -> 'criteria', '{}'::jsonb);
  modes    JSONB   := COALESCE(_spec -> 'modes', '{}'::jsonb);
  crit_on  BOOLEAN := COALESCE((modes ->> 'criteria')::boolean, false);
  mode_spec BOOLEAN := COALESCE((modes ->> 'specific')::boolean, false);
  mode_imp  BOOLEAN := COALESCE((modes ->> 'import')::boolean, false);
  reg_from DATE    := NULLIF(c -> 'registration' ->> 'from', '')::date;
  reg_to   DATE    := NULLIF(c -> 'registration' ->> 'to', '')::date;
  credit_min NUMERIC := NULLIF(c -> 'credit' ->> 'min', '')::numeric;
  credit_max NUMERIC := NULLIF(c -> 'credit' ->> 'max', '')::numeric;
  incl_null_prov BOOLEAN := COALESCE((c ->> 'includeNullProvince')::boolean, true);
  user_ids UUID[];
  emails   TEXT[];
  acct     TEXT[];
  kycs     TEXT[];
  provs    TEXT[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(array_agg(t.x::uuid), ARRAY[]::uuid[]) INTO user_ids
    FROM jsonb_array_elements_text(COALESCE(_spec -> 'userIds', '[]'::jsonb)) AS t(x);
  SELECT COALESCE(array_agg(lower(t.x)), ARRAY[]::text[]) INTO emails
    FROM jsonb_array_elements_text(COALESCE(_spec -> 'emails', '[]'::jsonb)) AS t(x);
  SELECT COALESCE(array_agg(t.x), ARRAY[]::text[]) INTO acct
    FROM jsonb_array_elements_text(COALESCE(c -> 'accountTypes', '[]'::jsonb)) AS t(x);
  SELECT COALESCE(array_agg(t.x), ARRAY[]::text[]) INTO kycs
    FROM jsonb_array_elements_text(COALESCE(c -> 'kycStatuses', '[]'::jsonb)) AS t(x);
  SELECT COALESCE(array_agg(t.x), ARRAY[]::text[]) INTO provs
    FROM jsonb_array_elements_text(COALESCE(c -> 'provinces', '[]'::jsonb)) AS t(x);

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id,
      p.email,
      p.name,
      p.created_at,
      p.kyc_status,
      p.notifications_enabled,
      EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id = p.id AND r.role = 'ADMIN'::app_role) AS is_admin,
      (EXISTS(SELECT 1 FROM organizations o WHERE o.owner_id = p.id)
       OR EXISTS(SELECT 1 FROM organization_memberships m WHERE m.user_id = p.id))            AS is_company_rep,
      EXISTS(SELECT 1 FROM asset_owner_kyc k WHERE k.user_id = p.id)                          AS is_owner_individual,
      EXISTS(SELECT 1 FROM asset_owner_org_kyc ok WHERE ok.created_by = p.id)                 AS is_owner_org,
      COALESCE(uc.balance, 0) AS credit_balance,
      COALESCE(
        (SELECT ao.province FROM organizations o
           JOIN auction_organizations ao ON ao.id::text = (o.license_info ->> 'auction_org_id')
          WHERE o.owner_id = p.id AND ao.province IS NOT NULL LIMIT 1),
        (SELECT ao.province FROM organization_memberships m
           JOIN organizations o ON o.id = m.organization_id
           JOIN auction_organizations ao ON ao.id::text = (o.license_info ->> 'auction_org_id')
          WHERE m.user_id = p.id AND ao.province IS NOT NULL LIMIT 1),
        (SELECT ao.province FROM asset_owner_org_kyc ok
           JOIN auction_organizations ao ON ao.id = ok.linked_auction_org_id
          WHERE ok.created_by = p.id AND ao.province IS NOT NULL LIMIT 1),
        (SELECT ap.province FROM asset_postings ap
          WHERE ap.user_id = p.id AND ap.province IS NOT NULL
          ORDER BY ap.created_at DESC LIMIT 1)
      ) AS province
    FROM profiles p
    LEFT JOIN user_credits uc ON uc.user_id = p.id
  ),
  matched AS (
    SELECT b.* FROM base b
    WHERE
      (
        crit_on
        AND (reg_from IS NULL OR b.created_at >= reg_from)
        AND (reg_to   IS NULL OR b.created_at < (reg_to + 1))
        AND (
          array_length(acct, 1) IS NULL
          OR (b.is_admin            AND 'admin'            = ANY(acct))
          OR (b.is_company_rep      AND 'company_rep'      = ANY(acct))
          OR (b.is_owner_individual AND 'owner_individual' = ANY(acct))
          OR (b.is_owner_org        AND 'owner_org'        = ANY(acct))
          OR (NOT (b.is_admin OR b.is_company_rep OR b.is_owner_individual OR b.is_owner_org)
              AND 'buyer' = ANY(acct))
        )
        AND (array_length(kycs, 1) IS NULL OR b.kyc_status::text = ANY(kycs))
        AND (credit_min IS NULL OR b.credit_balance >= credit_min)
        AND (credit_max IS NULL OR b.credit_balance <= credit_max)
        AND (
          array_length(provs, 1) IS NULL
          OR b.province = ANY(provs)
          OR (incl_null_prov AND b.province IS NULL)
        )
      )
      OR (mode_spec AND array_length(user_ids, 1) IS NOT NULL AND b.id = ANY(user_ids))
      OR (mode_imp  AND array_length(emails, 1)   IS NOT NULL AND lower(b.email) = ANY(emails))
  ),
  filtered AS (
    SELECT m.* FROM matched m
    WHERE (NOT _respect_optin) OR m.notifications_enabled = true
  )
  SELECT f.id, f.email, f.name, COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.email
  OFFSET COALESCE(_offset, 0)
  LIMIT _limit;
END;
$$;

-- Cheap count for the live preview: reuse resolve() and read the window total.
CREATE OR REPLACE FUNCTION public.count_campaign_audience(
  _spec          JSONB,
  _respect_optin BOOLEAN DEFAULT true
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT r.total_count FROM public.resolve_campaign_audience(_spec, _respect_optin, 1, 0) r LIMIT 1),
    0
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_campaign_audience(JSONB, BOOLEAN, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_campaign_audience(JSONB, BOOLEAN)             TO authenticated;

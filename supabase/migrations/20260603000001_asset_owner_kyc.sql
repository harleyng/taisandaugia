-- Asset Owner KYC: 5 new tables + bucket + RLS + auto-workspace trigger
-- Adds Layer 3 (role-based KYC) for asset owners, separate from existing
-- company onboarding (organizations table) and personal profile (profiles.agent_info).

-- ─── 1. Individual KYC ────────────────────────────────────────────────────────

CREATE TABLE public.asset_owner_kyc (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),

  -- Identity (pre-filled from Layer 2 where available)
  full_name         TEXT,
  phone             TEXT,
  phone_verified    BOOLEAN NOT NULL DEFAULT false,
  contact_email     TEXT,

  -- eKYC docs (Storage paths, served via signed URL)
  id_type           TEXT CHECK (id_type IN ('cccd', 'passport')),
  id_number         TEXT,
  id_front_url      TEXT,
  id_back_url       TEXT,
  selfie_url        TEXT,

  -- Admin review
  rejection_reason  TEXT,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES public.profiles(id),

  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_owner_kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_owner_kyc_own_rows"
  ON public.asset_owner_kyc FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status IN ('draft', 'pending_review'));

-- ─── 2. Organization KYC — Tier 1 ────────────────────────────────────────────

CREATE TABLE public.asset_owner_org_kyc (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pending_review', 'under_review', 'approved', 'rejected')),

  -- Organization info
  org_type              TEXT CHECK (org_type IN ('bank_credit', 'amc', 'enforcement', 'state_agency', 'administrator')),
  org_name              TEXT,
  tax_code              TEXT,
  official_email        TEXT,
  email_domain          TEXT,

  -- Match against auction_organizations registry (supplementary check)
  linked_auction_org_id UUID REFERENCES public.auction_organizations(id),
  registry_match_score  NUMERIC(4,3),
  registry_match_data   JSONB,

  -- Representative / authorized person
  rep_full_name         TEXT,
  rep_title             TEXT,
  rep_id_type           TEXT CHECK (rep_id_type IN ('cccd', 'passport')),
  rep_id_number         TEXT,
  rep_id_front_url      TEXT,
  rep_id_back_url       TEXT,
  rep_selfie_url        TEXT,

  -- Organization documents
  establishment_doc_url TEXT,
  authorization_doc_url TEXT,

  -- Admin review
  rejection_reason      TEXT,
  review_notes          TEXT,
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           UUID REFERENCES public.profiles(id),

  submitted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_owner_org_kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_owner_org_kyc_own_rows"
  ON public.asset_owner_org_kyc FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by AND status IN ('draft', 'pending_review'));

-- ─── 3. Workspace (created auto after Tier 1 approval) ────────────────────────

CREATE TABLE public.asset_owner_workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_kyc_id      UUID NOT NULL UNIQUE REFERENCES public.asset_owner_org_kyc(id) ON DELETE CASCADE,
  owner_user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Match seeds
  primary_name    TEXT NOT NULL,
  abbreviations   TEXT[] NOT NULL DEFAULT '{}',
  branch_names    TEXT[] NOT NULL DEFAULT '{}',

  -- Stats updated each time matching runs
  last_matched_at TIMESTAMPTZ,
  total_claimed   INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_owner_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_owner_workspaces_own_rows"
  ON public.asset_owner_workspaces FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- ─── 4. Asset Claims — Tier 2 ─────────────────────────────────────────────────

CREATE TABLE public.asset_owner_claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  listing_id        UUID REFERENCES public.listings(id),
  asset_owner_id    UUID REFERENCES public.asset_owners(id),

  -- Match metadata
  confidence_score  NUMERIC(4,3),
  match_basis       TEXT CHECK (match_basis IN ('auto_name', 'manual_search', 'admin_assigned')),
  matched_name      TEXT,

  status            TEXT NOT NULL DEFAULT 'pending_confirmation'
                    CHECK (status IN ('auto_claimed', 'pending_confirmation', 'confirmed', 'rejected')),

  -- Feedback loop
  confirmed_by      UUID REFERENCES public.profiles(id),
  confirmed_at      TIMESTAMPTZ,
  rejection_reason  TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, listing_id)
);

ALTER TABLE public.asset_owner_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_owner_claims_via_workspace"
  ON public.asset_owner_claims FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.asset_owner_workspaces WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.asset_owner_workspaces WHERE owner_user_id = auth.uid()
    )
  );

-- ─── 5. KYC Audit Events ──────────────────────────────────────────────────────

CREATE TABLE public.asset_owner_kyc_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('individual_kyc', 'org_kyc', 'workspace', 'claim')),
  entity_id     UUID NOT NULL,
  action        TEXT NOT NULL,
  actor_id      UUID REFERENCES public.profiles(id),
  data          JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_owner_kyc_events ENABLE ROW LEVEL SECURITY;

-- Only service role reads events; users may insert their own
CREATE POLICY "asset_owner_kyc_events_insert_own"
  ON public.asset_owner_kyc_events FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

-- ─── updated_at triggers ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_owner_kyc_updated_at
  BEFORE UPDATE ON public.asset_owner_kyc
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER asset_owner_org_kyc_updated_at
  BEFORE UPDATE ON public.asset_owner_org_kyc
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER asset_owner_workspaces_updated_at
  BEFORE UPDATE ON public.asset_owner_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER asset_owner_claims_updated_at
  BEFORE UPDATE ON public.asset_owner_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Auto-create workspace when org KYC is approved ──────────────────────────

CREATE OR REPLACE FUNCTION public.create_workspace_on_org_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    INSERT INTO public.asset_owner_workspaces (org_kyc_id, owner_user_id, primary_name)
    VALUES (NEW.id, NEW.created_by, COALESCE(NEW.org_name, ''))
    ON CONFLICT (org_kyc_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_owner_org_kyc_approve
  AFTER UPDATE OF status ON public.asset_owner_org_kyc
  FOR EACH ROW EXECUTE FUNCTION public.create_workspace_on_org_approval();

-- ─── Storage bucket: kyc-ekyc (private) ──────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-ekyc',
  'kyc-ekyc',
  false,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Users can only read their own eKYC files (path starts with their user_id)
CREATE POLICY "kyc_ekyc_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-ekyc'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_ekyc_owner_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-ekyc'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_ekyc_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'kyc-ekyc'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_ekyc_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'kyc-ekyc'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

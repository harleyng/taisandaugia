-- Credit balance per user
CREATE TABLE IF NOT EXISTS user_credits (
  user_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only transaction ledger
CREATE TABLE IF NOT EXISTS credit_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  description  TEXT NOT NULL,
  credit_delta INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);

-- Permanent asset unlocks
CREATE TABLE IF NOT EXISTS user_asset_unlocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_user_asset_unlocks_user ON user_asset_unlocks(user_id);

-- Time-limited company access
CREATE TABLE IF NOT EXISTS user_company_unlocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id     TEXT NOT NULL,
  tier       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_company_unlocks_user ON user_company_unlocks(user_id, org_id);

-- Time-limited owner access
CREATE TABLE IF NOT EXISTS user_owner_unlocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id   TEXT NOT NULL,
  tier       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_owner_unlocks_user ON user_owner_unlocks(user_id, owner_id);

-- Permanent deep-report period unlocks (key = '{slug}:{periodId}')
CREATE TABLE IF NOT EXISTS user_report_unlocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unlock_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, unlock_key)
);

CREATE INDEX IF NOT EXISTS idx_user_report_unlocks_user ON user_report_unlocks(user_id);

-- Invoice billing info stored alongside the user profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_info JSONB;

-- Row Level Security
ALTER TABLE user_credits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_asset_unlocks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_company_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_owner_unlocks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_report_unlocks  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows" ON user_credits         FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own rows" ON credit_transactions  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own rows" ON user_asset_unlocks   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own rows" ON user_company_unlocks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own rows" ON user_owner_unlocks   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own rows" ON user_report_unlocks  FOR ALL USING (auth.uid() = user_id);

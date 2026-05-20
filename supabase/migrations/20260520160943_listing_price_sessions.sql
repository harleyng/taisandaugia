CREATE TABLE IF NOT EXISTS listing_price_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  session_date  DATE NOT NULL,
  price         DECIMAL(15,3) NOT NULL,
  area          DECIMAL(10,2),
  district      TEXT,
  property_type TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_price_sessions_listing ON listing_price_sessions(listing_id, session_date DESC);

ALTER TABLE listing_price_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON listing_price_sessions
  FOR SELECT USING (true);

CREATE POLICY "admin insert" ON listing_price_sessions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "admin update" ON listing_price_sessions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'ADMIN')
  );

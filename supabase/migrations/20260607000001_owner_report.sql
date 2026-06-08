-- owner_report_views: log every report view for billing reconciliation
CREATE TABLE IF NOT EXISTS owner_report_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES asset_owner_workspaces(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  filter_combo    JSONB NOT NULL DEFAULT '{}',
  is_default      BOOLEAN NOT NULL DEFAULT true,
  credits_charged INT NOT NULL DEFAULT 0,
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_report_views_ws
  ON owner_report_views(workspace_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_owner_report_views_usr
  ON owner_report_views(user_id, viewed_at DESC);

ALTER TABLE owner_report_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows"
  ON owner_report_views
  FOR ALL
  USING (auth.uid() = user_id);

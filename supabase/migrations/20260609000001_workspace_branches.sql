-- Workspace branches: operational overlay for branches/AMCs per workspace
-- Stores display info and active status without modifying the shared asset_owners table.

CREATE TABLE public.workspace_branches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  asset_owner_id UUID REFERENCES public.asset_owners(id) ON DELETE SET NULL,
  display_name   TEXT,
  contact_phone  TEXT,
  contact_email  TEXT,
  notes          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  is_amc         BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, asset_owner_id)
);

ALTER TABLE public.workspace_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_branches_via_workspace"
  ON public.workspace_branches FOR ALL
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

CREATE TRIGGER workspace_branches_updated_at
  BEFORE UPDATE ON public.workspace_branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

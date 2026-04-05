CREATE TABLE public.user_asset_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL,
  is_saved boolean NOT NULL DEFAULT false,
  is_following boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE public.user_asset_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own actions" ON public.user_asset_actions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own actions" ON public.user_asset_actions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own actions" ON public.user_asset_actions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own actions" ON public.user_asset_actions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_user_asset_actions_updated_at
  BEFORE UPDATE ON public.user_asset_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
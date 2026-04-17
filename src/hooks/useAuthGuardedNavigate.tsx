import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthDialog } from "@/contexts/AuthDialogContext";

/**
 * Returns a click handler that navigates to `path` if logged in,
 * or opens the auth popup with a pending action to navigate after login.
 */
export const useAuthGuardedNavigate = () => {
  const navigate = useNavigate();
  const { openAuthDialog } = useAuthDialog();

  return useCallback(
    (path: string) => async (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate(path);
      } else {
        openAuthDialog(() => navigate(path));
      }
    },
    [navigate, openAuthDialog]
  );
};

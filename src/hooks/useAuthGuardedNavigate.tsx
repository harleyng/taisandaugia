import { useCallback } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthDialog } from "@/contexts/AuthDialogContext";

/**
 * Returns a click handler that navigates to `path` if logged in,
 * or opens the auth popup with a pending action to navigate after login.
 * Optionally accepts NavigateOptions (e.g., `state`) to forward to react-router.
 */
export const useAuthGuardedNavigate = () => {
  const navigate = useNavigate();
  const { openAuthDialog } = useAuthDialog();

  return useCallback(
    (path: string, options?: NavigateOptions) =>
      async (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate(path, options);
        } else {
          openAuthDialog(() => navigate(path, options));
        }
      },
    [navigate, openAuthDialog]
  );
};

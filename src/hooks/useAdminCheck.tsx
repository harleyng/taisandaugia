import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

interface UseAdminCheckResult {
  isAdmin: boolean;
  loading: boolean;
  session: Session | null;
}

export const useAdminCheck = (): UseAdminCheckResult => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate("/auth");
          return;
        }

        setSession(session);

        // Check if user has admin role
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "ADMIN")
          .maybeSingle();

        if (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
          navigate("/");
          return;
        }

        if (!roleData) {
          setIsAdmin(false);
          navigate("/");
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error("Error in admin check:", error);
        setIsAdmin(false);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return { isAdmin, loading, session };
};

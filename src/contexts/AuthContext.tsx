import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  userId: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  userId: null,
  loading: true,
});

/**
 * Nguồn auth DUY NHẤT cho toàn app.
 *
 * Trước đây mỗi hook/component tự gọi `supabase.auth.getSession()` +
 * `onAuthStateChange` (Header, useCredits, useOnboardingTasks, ProtectedRoute,
 * useAssetActions, useAuthState…), gây ~7 subscription trùng lặp mỗi lần load.
 * Provider này chạy MỘT lần và phát session xuống qua context.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Listener toàn cục cho `notifyProfileUpdated()` — invalidate mọi query profile.
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    };
    window.addEventListener("onboarding:profile-updated", handler);
    return () => window.removeEventListener("onboarding:profile-updated", handler);
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ session, userId: session?.user?.id ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

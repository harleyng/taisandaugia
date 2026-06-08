import { useState, useEffect } from "react";
import { type Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, loading, userId: session?.user?.id ?? null };
}

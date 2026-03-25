import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type KycStatus = "NOT_APPLIED" | "PENDING_KYC" | "APPROVED" | "REJECTED";

interface Profile {
  kyc_status: KycStatus;
  rejection_reason: string | null;
}

export const useKycStatus = () => {
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKycStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("kyc_status, rejection_reason")
          .eq("id", session.user.id)
          .single();

        if (error) throw error;

        if (data) {
          setKycStatus(data.kyc_status);
          setRejectionReason(data.rejection_reason);
        }
      } catch (error) {
        console.error("Error fetching KYC status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchKycStatus();

    // Subscribe to profile changes
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          const updated = payload.new as Profile;
          setKycStatus(updated.kyc_status);
          setRejectionReason(updated.rejection_reason);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { kycStatus, rejectionReason, loading };
};

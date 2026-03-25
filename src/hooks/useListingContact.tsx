import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ListingContact {
  id: string;
  listing_id: string;
  contact_info: {
    name: string;
    phone: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch contact information for a specific listing
 * Only returns data if the user is:
 * - The listing owner
 * - An admin
 * Otherwise returns null (protected by RLS)
 */
export const useListingContact = (listingId: string | undefined) => {
  return useQuery({
    queryKey: ["listing-contact", listingId],
    queryFn: async () => {
      if (!listingId) return null;

      const { data, error } = await supabase
        .from("listing_contacts")
        .select("*")
        .eq("listing_id", listingId)
        .maybeSingle();

      // RLS will prevent unauthorized access, so no error if null
      if (error) throw error;
      return data as ListingContact | null;
    },
    enabled: !!listingId,
  });
};

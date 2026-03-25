import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Listing {
  id: string;
  title: string;
  description: string | null;
  price: number;
  price_unit: string;
  purpose: string;
  property_type_slug: string;
  status: string;
  address: any; // JSON
  coordinates: any; // JSON
  // Note: contact_info moved to listing_contacts table for security
  // Use useListingContact hook to fetch contact information
  area: number;
  num_bedrooms: number | null;
  num_bathrooms: number | null;
  num_floors: number | null;
  floor_number: number | null;
  house_direction: string | null;
  balcony_direction: string | null;
  land_direction: string | null;
  facade_width: number | null;
  depth: number | null;
  alley_width: number | null;
  legal_status: string | null;
  interior_status: string | null;
  image_url: string | null;
  featured: boolean | null;
  verified: boolean | null;
  views_count: number | null;
  created_at: string;
  updated_at: string;
  attributes: any; // JSON
  prominent_features: string[] | null;
  custom_attributes: any;
}

export const useListings = () => {
  return useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Listing[];
    },
  });
};

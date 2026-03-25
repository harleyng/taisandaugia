import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PropertyType {
  id: string;
  name: string;
  slug: string;
  filter_metadata: {
    FOR_SALE?: {
      available: boolean;
      filters: string[];
    };
    FOR_RENT?: {
      available: boolean;
      filters: string[];
    };
  };
  created_at: string;
  updated_at: string;
}

export const usePropertyTypes = () => {
  return useQuery({
    queryKey: ["property-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_types")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as PropertyType[];
    },
  });
};

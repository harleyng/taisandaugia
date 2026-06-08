import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useListingById(id: string | undefined) {
  return useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      if (!id) throw new Error("ID không hợp lệ");
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      if (!data) throw new Error("Không tìm thấy tài sản");

      const { data: propertyTypeData } = await supabase
        .from("property_types")
        .select("name, slug")
        .eq("slug", data.property_type_slug)
        .single();

      return {
        ...data,
        property_types: propertyTypeData || { name: "BĐS", slug: data.property_type_slug },
      };
    },
    enabled: !!id,
    staleTime: 60_000,
    retry: false,
  });
}

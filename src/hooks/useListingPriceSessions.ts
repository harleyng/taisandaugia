import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RawSession } from "@/lib/auctionPriceAnalytics";

export const useListingPriceSessions = (listingId: string | undefined) =>
  useQuery({
    queryKey: ["listing-price-sessions", listingId],
    queryFn: async (): Promise<RawSession[]> => {
      const { data, error } = await supabase
        .from("listing_price_sessions")
        .select("session_date, price, area, district, property_type")
        .eq("listing_id", listingId!)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        // RawSession.date là Date, không phải chuỗi: computeAnalytics gọi
        // s.date.getFullYear() (auctionPriceAnalytics.ts:211) và so sánh
        // s.date >= cutoff. Trả về chuỗi ISO là crash biểu đồ lịch sử giá
        // ngay khi listing có phiên thật trong DB.
        date: new Date(r.session_date),
        price: r.price,
        area: r.area ?? undefined,
        district: r.district ?? undefined,
        property_type: r.property_type ?? undefined,
      }));
    },
    enabled: !!listingId,
    staleTime: 60_000,
  });

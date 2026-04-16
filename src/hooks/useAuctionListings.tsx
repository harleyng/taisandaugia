import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AuctionSessionStatus } from "@/components/AuctionCard";

export interface AuctionListing {
  id: string;
  title: string;
  description: string | null;
  price: number;
  property_type_slug: string;
  status: string;
  address: any;
  image_url: string | null;
  area: number;
  created_at: string;
  custom_attributes: any;
  views_count: number | null;
  auction_org_id: string | null;
  asset_owner_id: string | null;
}

export function getSessionStatus(listing: AuctionListing): AuctionSessionStatus {
  const ca = listing.custom_attributes;

  // Explicit status override
  if (ca?.session_status) {
    const s = ca.session_status as string;
    if (s === "ongoing") return "ongoing";
    if (s === "ended") return "ended";
    if (s === "registration_open") return "registration_open";
    if (s === "upcoming") return "upcoming";
    // Legacy "upcoming" might mean registration_open, re-evaluate below
  }

  if (listing.status === "SOLD_RENTED") return "ended";

  const now = new Date();

  // auction_date / auction_time is when the auction happens
  const auctionDateStr = ca?.auction_date || ca?.auction_time;
  const auctionDate = auctionDateStr ? new Date(auctionDateStr) : null;

  // document_sale_end / registration_deadline is when registration closes
  const regDeadlineStr = ca?.registration_deadline || ca?.document_sale_end;
  const regDeadline = regDeadlineStr ? new Date(regDeadlineStr) : null;

  if (auctionDate) {
    // Past auction time
    if (auctionDate <= now) {
      // 2-hour window for ongoing
      const twoHoursLater = new Date(auctionDate.getTime() + 2 * 60 * 60 * 1000);
      if (now <= twoHoursLater) return "ongoing";
      return "ended";
    }

    // Before auction time - check registration
    if (regDeadline) {
      if (now <= regDeadline) return "registration_open";
      return "upcoming"; // past registration but before auction
    }

    // No registration deadline info - default to registration_open
    return "registration_open";
  }

  // No auction date info
  return "registration_open";
}

export const useAuctionListings = () => {
  return useQuery({
    queryKey: ["auction-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .in("status", ["ACTIVE", "SOLD_RENTED"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AuctionListing[];
    },
  });
};

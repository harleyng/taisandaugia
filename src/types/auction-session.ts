// Phiên đấu giá (auction_sessions) + lô tài sản (auction_session_items).
// Bảng + trigger + RLS: supabase/migrations/20260911000003_auction_sessions.sql.

import type { Tables } from "@/integrations/supabase/types";
import type { AuctionFormat } from "@/types/asset-posting";
import type { SessionPublishStatus } from "@/lib/auctionSessions/phase";

export type { AuctionFormat, SessionPublishStatus };
export type SessionItemSource = "listing" | "posting";

type SessionRow = Tables<"auction_sessions">;
type ItemRow = Tables<"auction_session_items">;

export type AuctionSession = Omit<SessionRow, "status" | "auction_format"> & {
  status: SessionPublishStatus;
  auction_format: AuctionFormat;
};

export type AuctionSessionItem = Omit<ItemRow, "source"> & { source: SessionItemSource };

export interface AuctionSessionWithItems extends AuctionSession {
  auction_session_items: AuctionSessionItem[];
}

export interface OrgSessionListRow extends AuctionSession {
  item_count: number;
}

/** Trường tổ chức được sửa. organization_id / code / status / auction_org_id do server quản. */
export type SessionInput = Pick<
  SessionRow,
  | "title"
  | "description"
  | "venue"
  | "province"
  | "max_registrants"
  | "dossier_fee"
  | "registration_start_at"
  | "registration_end_at"
  | "viewing_start_at"
  | "viewing_end_at"
  | "starts_at"
  | "ends_at"
> & { auction_format: AuctionFormat };

type ItemSnapshot = Pick<
  ItemRow,
  "title" | "category_slug" | "province" | "district" | "image_url" | "starting_price" | "deposit_amount" | "bid_step"
>;

/** Một lô trước khi thêm vào phiên. lot_no / service_request_id do trigger cấp. */
export type SessionItemDraft = ItemSnapshot &
  ({ source: "listing"; listing_id: string } | { source: "posting"; asset_posting_id: string });

export type SessionItemPatch = Partial<
  Pick<ItemRow, "title" | "starting_price" | "deposit_amount" | "bid_step" | "max_registrants">
>;

// ─── Bản công khai ─────────────────────────────────────────────────────────
// Không mang organization_id / created_by / timestamps nội bộ: query công khai
// liệt kê cột bằng tay (xem usePublicAuctionSessions).

export type PublicSession = Omit<AuctionSession, "organization_id" | "created_by" | "created_at" | "updated_at">;

export interface PublicSessionOrg {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface PublicSessionLotSummary {
  id: string;
  starting_price: number | null;
  image_url: string | null;
  category_slug: string | null;
}

export interface PublicSessionSummary extends PublicSession {
  auction_organizations: PublicSessionOrg | null;
  auction_session_items: PublicSessionLotSummary[];
}

export interface PublicSessionDetail extends PublicSession {
  auction_organizations: PublicSessionOrg | null;
  auction_session_items: AuctionSessionItem[];
}

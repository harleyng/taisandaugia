// Giám sát phiên đấu giá trực tuyến trong admin (/admin/phien-dau-gia) — Phase 6.2
// của docs/auction-platform-split-plan.md. CHỈ ĐỌC: phiên do tổ chức điều hành trên
// sàn taisanviet; admin xem qua RPC admin_auction_sessions / admin_auction_session_detail
// (READ CONTRACT — manifest §3), không đọc thẳng bảng AUC.
// Module THUẦN: không import React / Supabase client.

import type { Database } from "@/integrations/supabase/types";
import { sessionPhaseOf } from "@/lib/auctionCore/phase";
import { SESSION_STATUS_LABELS } from "@/lib/listings/sessionStatus";
import { normalizeVi } from "@/lib/normalizeVi";

export type AdminAuctionSessionRow = Database["public"]["Functions"]["admin_auction_sessions"]["Returns"][number];

/** Trạng thái giám sát — gộp vòng đời công bố (status) với giai đoạn theo giờ + lô đang mở. */
export type MonitorState = "live" | "upcoming" | "ended" | "draft" | "cancelled";

export const MONITOR_STATE_LABELS: Record<MonitorState, string> = {
  live: "Đang đấu giá",
  upcoming: "Sắp diễn ra",
  ended: "Đã kết thúc",
  draft: "Nháp",
  cancelled: "Đã huỷ",
};

type MonitorTiming = Pick<AdminAuctionSessionRow, "status" | "starts_at" | "ends_at" | "registration_end_at"> & {
  live_lot_count?: number | null;
};

/**
 * Có lô đang mở / tạm dừng / chờ vòng phụ ⇒ "live" kể cả khi đã quá giờ kết thúc dự kiến
 * (lô gia hạn); đã công bố mà chưa tới giờ ⇒ "upcoming".
 */
export function monitorStateOf(s: MonitorTiming, now: Date = new Date()): MonitorState {
  if (s.status === "draft" || s.status === "cancelled") return s.status;
  if ((s.live_lot_count ?? 0) > 0) return "live";
  const phase = sessionPhaseOf(s, now);
  if (phase === "ongoing") return "live";
  if (phase === "ended") return "ended";
  return "upcoming";
}

/** Nhãn phụ cho phiên sắp diễn ra: còn bán hồ sơ hay đã khoá. */
export function upcomingDetailOf(s: MonitorTiming, now: Date = new Date()): string | null {
  if (monitorStateOf(s, now) !== "upcoming") return null;
  return SESSION_STATUS_LABELS[sessionPhaseOf(s, now)];
}

export type MonitorTab = "tat-ca" | MonitorState;

export const MONITOR_TABS: { key: MonitorTab; label: string }[] = [
  { key: "tat-ca", label: "Tất cả" },
  { key: "live", label: MONITOR_STATE_LABELS.live },
  { key: "upcoming", label: MONITOR_STATE_LABELS.upcoming },
  { key: "ended", label: MONITOR_STATE_LABELS.ended },
  { key: "draft", label: MONITOR_STATE_LABELS.draft },
  { key: "cancelled", label: MONITOR_STATE_LABELS.cancelled },
];

export function matchesMonitorSearch(r: Pick<AdminAuctionSessionRow, "code" | "title" | "org_name" | "province">, q: string): boolean {
  const needle = normalizeVi(q.trim());
  if (!needle) return true;
  return [r.code, r.title, r.org_name, r.province].some((v) => v && normalizeVi(v).includes(needle));
}

export function countByTab(rows: AdminAuctionSessionRow[], now: Date = new Date()): Record<MonitorTab, number> {
  const out: Record<MonitorTab, number> = { "tat-ca": rows.length, live: 0, upcoming: 0, ended: 0, draft: 0, cancelled: 0 };
  for (const r of rows) out[monitorStateOf(r, now)] += 1;
  return out;
}

export const BIDDING_METHOD_LABELS: Record<string, string> = {
  ascending: "Trả giá lên",
  descending: "Đặt giá xuống",
  sealed: "Bỏ phiếu kín",
};

export const AUCTION_FORMAT_LABELS: Record<string, string> = {
  truc_tiep: "Trực tiếp",
  truc_tuyen: "Trực tuyến",
  ca_hai: "Trực tiếp + trực tuyến",
};

// ─── Chi tiết phiên (JSONB của admin_auction_session_detail) ─────────────────
export type LotState = "pending" | "open" | "paused" | "tied" | "closed" | "withdrawn";

export const LOT_STATE_LABELS: Record<LotState, string> = {
  pending: "Chưa mở",
  open: "Đang đấu",
  paused: "Tạm dừng",
  tied: "Chờ vòng phụ",
  closed: "Đã đóng",
  withdrawn: "Đã rút",
};

export const isLiveLot = (state: LotState | null | undefined): boolean =>
  state === "open" || state === "paused" || state === "tied";

export const SALE_CONTRACT_STATUS_LABELS: Record<string, string> = {
  drafting: "Đang soạn",
  awaiting_signatures: "Chờ ký",
  awaiting_confirmation: "Chờ xác nhận",
  signed: "Đã ký",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

export interface MonitorLot {
  id: string;
  lot_no: number;
  title: string;
  starting_price: number | null;
  deposit_amount: number | null;
  state: LotState | null;
  current_price: number | null;
  bid_count: number;
  leading_bidder_no: number | null;
  round_no: number | null;
  opened_at: string | null;
  ends_at: string | null;
  closed_at: string | null;
  result: "sold" | "unsold" | null;
  winning_amount: number | null;
  payment_status: "pending" | "paid" | "defaulted" | null;
}

export interface MonitorDossierStats {
  total: number;
  pending_payment: number;
  paid: number;
  refunded: number;
  cancelled: number;
  review_pending: number;
  needs_info: number;
  approved: number;
  rejected: number;
  deposit_received: number;
  checked_in: number;
  absent: number;
}

export interface MonitorSaleContract {
  id: string;
  code: string | null;
  lot_id: string | null;
  status: string;
  price: number | null;
  created_at: string;
}

export interface MonitorSessionDetail {
  session: {
    id: string;
    code: string;
    title: string;
    status: "draft" | "published" | "cancelled";
    auction_format: string;
    bidding_method: string;
    venue: string | null;
    province: string | null;
    org_name: string | null;
    organization_id: string | null;
    registration_start_at: string | null;
    registration_end_at: string | null;
    starts_at: string;
    ends_at: string;
    dossier_fee: number | null;
    published_at: string | null;
    roster_closed_at: string | null;
    finalized_at: string | null;
    cancelled_reason: string | null;
    created_at: string;
    updated_at: string;
  };
  lots: MonitorLot[];
  dossiers: MonitorDossierStats;
  sale_contracts: MonitorSaleContract[];
}

export const liveLotCount = (d: Pick<MonitorSessionDetail, "lots"> | null | undefined): number =>
  (d?.lots ?? []).filter((l) => isLiveLot(l.state)).length;

/** Lô đang đấu ⇒ làm mới nhanh; còn lại chỉ làm mới khi người xem bấm / quay lại tab. */
export const DETAIL_LIVE_REFRESH_MS = 10_000;
export const LIST_REFRESH_MS = 30_000;

/** Sàn chỉ hiện phiên đã công bố cho khách ⇒ nháp / đã huỷ không có link sang sàn. */
export const isVisibleOnAuctionSite = (s: Pick<AdminAuctionSessionRow, "status">): boolean => s.status === "published";

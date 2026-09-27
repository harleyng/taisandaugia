// Sổ "Kết quả phiên" (/chu-tai-san/ket-qua) theo design "Ket Qua Phien Chu Tai San":
// tab Cần xử lý / Tất cả / Thành / Không thành / Hoãn–Huỷ, hộp việc cần xử lý và bảng sổ.
// Thuần (không React) để test được. Luật gộp nguồn / lệch số vẫn ở server
// (RPC owner_outcomes_overview) — module này chỉ chọn cặp số để đặt cạnh nhau.

import type { ListingAddress } from "@/types/listing";
import { SALE_STATUS_LABELS } from "@/types/auction-sale-contract";
import { OUTCOME_KIND_LABEL, type OutcomeConfidence, type OutcomeSourceKind } from "@/lib/ownerOutcomes";
import type { OutcomeOverviewRow, OverviewSource } from "@/lib/ownerOutcomesOverview";

// ─── Tab ─────────────────────────────────────────────────────────────────────

/** "todo" = Cần xử lý (số liệu lệch + phiên đã qua chưa khai); còn lại là nhóm kết quả. */
export const LEDGER_TABS = ["todo", "all", "sold", "unsold", "void"] as const;
export type LedgerTab = (typeof LEDGER_TABS)[number];

export const LEDGER_TAB_LABEL: Record<LedgerTab, string> = {
  todo: "Cần xử lý",
  all: "Tất cả",
  sold: "Thành",
  unsold: "Không thành",
  void: "Hoãn / Huỷ",
};

/** Dòng mỗi trang của bảng sổ. */
export const LEDGER_PAGE_SIZE = 8;
/** Phiên chưa khai hiện sẵn trong hộp Cần xử lý; phần còn lại mở bằng "Xem thêm". */
export const INBOX_PENDING_VISIBLE = 4;

// ─── Tiền ────────────────────────────────────────────────────────────────────

/**
 * Tiền dạng ngắn của sổ: tỷ giữ tới 2 chữ số thập phân ("28.45 tỷ") để hai số
 * lệch nhau vài phần trăm không in ra giống hệt; dưới 1 tỷ làm tròn triệu ("865 tr").
 * Nhóm nghìn dấu phẩy, thập phân dấu chấm — cùng quy ước src/utils/money.ts.
 */
export function ledgerMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const tr = Math.round(abs / 1_000_000);
  if (abs >= 1_000_000_000 || tr >= 1000) {
    return `${sign}${(abs / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} tỷ`;
  }
  if (abs >= 1_000_000) return `${sign}${tr.toLocaleString("en-US")} tr`;
  return `${sign}${Math.round(abs).toLocaleString("en-US")} ₫`;
}

/** Giá trúng so với giá khởi điểm, % làm tròn; null khi thiếu một trong hai. */
export function priceVsStart(price: number | null, startingPrice: number | null): number | null {
  if (price === null || !startingPrice || startingPrice <= 0) return null;
  return Math.round((price / startingPrice - 1) * 100);
}

// ─── Hiển thị một dòng ───────────────────────────────────────────────────────

/** "Không thành" / "Hoãn" / "Huỷ phiên" …; đã bán mà thiếu giá ⇒ "Thành". */
export function outcomeText(outcome: OutcomeOverviewRow["outcome"]): string {
  if (!outcome) return "Chưa rõ";
  return outcome === "sold" ? "Thành" : OUTCOME_KIND_LABEL[outcome];
}

/** Địa chỉ gọn cho sổ: phường, quận — thiếu thì đường, tỉnh. */
export function shortAddress(address: ListingAddress | null | undefined): string {
  const near = [address?.ward, address?.district].filter(Boolean);
  if (near.length) return near.join(", ");
  return [address?.street, address?.province ?? address?.city].filter(Boolean).join(", ");
}

/** "2026-09-24" ⇒ "24/09/2026"; trống ⇒ "—". */
export function ledgerDay(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
}

// ─── Ghép thông tin tin đăng ─────────────────────────────────────────────────
// RPC owner_outcomes_overview không trả địa chỉ; tin trên sàn lấy từ danh mục
// (useOwnerPortfolioMetrics đã tải sẵn), tài sản ngoài sàn không có địa chỉ.

/** Phần của ListingRow mà sổ cần — ListingRow khớp cấu trúc này. */
export interface LedgerListingInfo {
  addressLine: string;
  roundCount: number;
  auctionOrgName: string | null;
}

export interface LedgerRow extends OutcomeOverviewRow {
  address: string | null;
  /** Lượt đơn vị khai, không thì số phiên của tin trên sàn. */
  round: number | null;
}

export function toLedgerRows(
  rows: OutcomeOverviewRow[],
  listings: ReadonlyMap<string, LedgerListingInfo>,
): LedgerRow[] {
  return rows.map((r) => {
    const l = r.listingId ? listings.get(r.listingId) : undefined;
    return {
      ...r,
      orgName: r.orgName ?? l?.auctionOrgName ?? null,
      address: l?.addressLine || null,
      round: r.ownRoundNo ?? (l?.roundCount || r.roundsReported || null),
    };
  });
}

// ─── Lệch số liệu ────────────────────────────────────────────────────────────

const USE_LABEL: Record<Exclude<OutcomeSourceKind, "owner_report">, string> = {
  org_report: "Dùng số tổ chức ĐG",
  platform: "Dùng số của sàn",
  crawled: "Dùng số ước tính",
};

export type ConflictAction =
  { choice: "keep_mine"; label: string } | { choice: "use_source"; label: string; sourceFp: string };

export interface ConflictView {
  /** Số của đơn vị (lượt hiện tại) nếu có, không thì nguồn đang dùng. */
  left: OverviewSource | null;
  /** Nguồn đang nói khác `left`. */
  right: OverviewSource | null;
  /** |Δ giá| / giá bên trái, 1 chữ số thập phân; null khi không so được hai giá. */
  gapPct: number | null;
  /** Nút xử lý hợp lệ theo luật của RPC owner_outcome_resolve_conflict — "Giữ số của tôi" đứng cuối. */
  actions: ConflictAction[];
}

/**
 * Đặt hai con số lệch cạnh nhau và chọn nút xử lý. `disagrees` của server là so
 * với nguồn THẮNG (sources[0]): nguồn thắng dùng được khi số của đơn vị lệch với
 * nó (hoặc đơn vị chưa khai lượt này); sàn thắng thì chỉ số của sàn dùng được và
 * không "giữ số của tôi" được.
 */
export function conflictView(row: Pick<OutcomeOverviewRow, "sources" | "bestKind">): ConflictView {
  const { sources, bestKind } = row;
  const winner = sources[0] ?? null;
  const own = sources.find((s) => s.kind === "owner_report" && s.inRound) ?? null;
  const left = own ?? winner;
  const right =
    sources.find(
      (s) => s !== left && s.kind !== "owner_report" && s.inRound && !s.dismissed && (s === winner || s.disagrees),
    ) ?? null;

  const usable = (s: OverviewSource) => {
    const relevant = s === winner ? !own || own.disagrees : s.disagrees && bestKind !== "platform";
    return relevant && !s.dismissed && s.inRound && !!s.fp && (s.outcome !== "sold" || s.price !== null);
  };

  const actions: ConflictAction[] = [];
  for (const s of [left, right].filter((x): x is OverviewSource => !!x)) {
    if (s.kind && s.kind !== "owner_report" && usable(s)) {
      actions.push({ choice: "use_source", label: USE_LABEL[s.kind], sourceFp: s.fp! });
    }
  }
  if (own && !(bestKind === "platform" && own.disagrees))
    actions.push({ choice: "keep_mine", label: "Giữ số của tôi" });
  // Nguồn xếp hạng cao hơn đứng trước (bên phải khi đơn vị đã khai — "Dùng số tổ chức ĐG" trước "Giữ số của tôi").
  actions.sort((a, b) => (a.choice === "keep_mine" ? 1 : 0) - (b.choice === "keep_mine" ? 1 : 0));

  const gapPct =
    left?.outcome === "sold" && right?.outcome === "sold" && left.price && right.price !== null
      ? Math.round((Math.abs(right.price - left.price) / left.price) * 1000) / 10
      : null;

  return { left, right, gapPct, actions };
}

/** Ai nói con số này — nhãn ô so sánh. */
export function sourceWho(s: OverviewSource): string {
  switch (s.kind) {
    case "owner_report":
      return "Bạn tự khai";
    case "org_report":
      return `${s.orgName ?? "Tổ chức đấu giá"} báo`;
    case "platform":
      return "Phiên trên sàn";
    case "crawled":
      return "Tin đăng thu thập";
    default:
      return "Nguồn khác";
  }
}

/** Con số một nguồn nói: giá trúng, hoặc nhãn kết quả. */
export function sourceValue(s: OverviewSource): string {
  if (s.outcome === "sold") return s.price !== null ? ledgerMoney(s.price) : "Thành";
  return s.outcome ? OUTCOME_KIND_LABEL[s.outcome] : "—";
}

// ─── Nguồn của con số (ngăn chi tiết) ────────────────────────────────────────

export interface TrailStep {
  /** Màu chấm theo độ tin. */
  confidence: OutcomeConfidence;
  title: string;
  detail: string;
}

const joinDot = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

/**
 * Các bước dẫn tới con số đang hiển thị: mỗi nguồn một bước (theo hạng, nguồn
 * thắng trước) rồi một bước kết luận theo nhãn độ tin. Chỉ kể lại những gì RPC
 * đã trả — không suy thêm.
 */
export function sourceTrail(row: Pick<OutcomeOverviewRow, "sources" | "confidence" | "hasConflict">): TrailStep[] {
  const multi = row.sources.length > 1;
  const steps: TrailStep[] = [];

  row.sources.forEach((s, i) => {
    const flags = [
      multi && i === 0 && "đang dùng",
      s.disagrees && !s.dismissed && "lệch với số đang dùng",
      s.dismissed && "đơn vị đã bỏ qua",
      !s.inRound && "lượt trước",
    ];
    const value = sourceValue(s);
    const day = s.date ? ledgerDay(s.date) : null;
    switch (s.kind) {
      case "platform":
        steps.push({
          confidence: "platform",
          title: "Sàn ghi nhận kết quả phiên",
          detail: joinDot("Tự động", day, s.sessionCode, value, ...flags),
        });
        if (s.contractStatus && s.contractStatus !== "cancelled") {
          steps.push({
            confidence: "platform",
            title: `Hợp đồng mua bán ${SALE_STATUS_LABELS[s.contractStatus].toLowerCase()}`,
            detail: joinDot("Trên sàn", s.contractCode),
          });
        }
        break;
      case "owner_report":
        steps.push({
          confidence: row.confidence === "owner_evidence" && i === 0 ? "owner_evidence" : "self_reported",
          title: "Bạn khai kết quả",
          detail: joinDot(day, s.roundNo !== null && `Lượt ${s.roundNo}`, value, ...flags),
        });
        break;
      case "org_report":
        steps.push({
          confidence: row.confidence === "reconciled" ? "reconciled" : "self_reported",
          title: `${s.orgName ?? "Tổ chức đấu giá"} báo kết quả`,
          detail: joinDot(day, value, ...flags),
        });
        break;
      default:
        steps.push({
          confidence: "estimated",
          title: "Tin đăng thu thập công khai",
          detail: joinDot(day, value, ...flags),
        });
    }
  });

  if (row.hasConflict) {
    steps.push({ confidence: "self_reported", title: "Các nguồn đang nói khác nhau", detail: "Chọn số đúng bên dưới" });
  } else if (row.confidence === "reconciled") {
    steps.push({ confidence: "reconciled", title: "Khớp với báo cáo của tổ chức ĐG", detail: "Chênh không quá 1%" });
  } else if (row.confidence === "owner_evidence") {
    steps.push({ confidence: "owner_evidence", title: "Đính kèm biên bản đấu giá", detail: "Có biên bản" });
  } else if (row.confidence === "self_reported") {
    steps.push({
      confidence: "self_reported",
      title: "Chưa có nguồn thứ hai",
      detail: "Đính kèm biên bản để tăng độ tin cậy",
    });
  }
  return steps;
}

// ─── Phân trang ──────────────────────────────────────────────────────────────

/** Số trang hiện trên thanh phân trang: tối đa 7 ô, `null` = dấu "…". */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const from = Math.max(2, Math.min(page - 1, pages - 4));
  const to = Math.min(pages - 1, Math.max(page + 1, 5));
  const out: (number | null)[] = [1];
  if (from > 2) out.push(null);
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push(null);
  out.push(pages);
  return out;
}

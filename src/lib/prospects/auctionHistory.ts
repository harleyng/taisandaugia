// Gộp số liệu lịch sử đấu giá của MỘT pháp nhân, ngay trên client.
//
// Cố ý không để Postgres gộp sẵn: bộ lọc ở đầu tab phải chi phối CẢ KPI, biểu đồ
// lẫn bảng. Nếu biểu đồ do RPC gộp sẵn thì lọc xong biểu đồ sẽ đứng im còn bảng
// đã đổi — hai con số lệch nhau trên cùng một màn hình. Dữ liệu tối đa 500 dòng
// nên gộp tại chỗ rẻ hơn nhiều so với gọi lại RPC mỗi lần đổi bộ lọc.

import { UNGROUPED_LABEL } from "./types";
import type { AuctionHistoryRow, CounterpartySlice, DistSlice, MonthPoint } from "./types";

export interface HistoryFilters {
  q: string;
  bucket: string;
  assetType: string;
  province: string;
  legal: string;
  /**
   * Phạm vi xem — MỘT bộ lọc duy nhất cho cả chi nhánh lẫn cụm, vì trên UI
   * chúng là hai cấp của cùng một cây "Chi nhánh/AMC". Mã hoá tiền tố:
   *   "all"          — trụ sở chính + mọi chi nhánh
   *   "unit:<id>"    — một đơn vị (trụ sở chính hoặc một chi nhánh)
   *   "group:<id>"   — cả một cụm
   *   "group:none"   — tin chưa thuộc cụm nào (trụ sở chính + chi nhánh chưa xếp)
   */
  scope: string;
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  q: "", bucket: "all", assetType: "all", province: "all", legal: "all",
  scope: "all",
};

export const SCOPE_ALL = "all";
export const scopeUnit = (id: string) => `unit:${id}`;
export const scopeGroup = (id: string | null) => `group:${id ?? "none"}`;

export const hasActiveHistoryFilters = (f: HistoryFilters) =>
  !!f.q.trim() ||
  f.bucket !== "all" ||
  f.assetType !== "all" ||
  f.province !== "all" ||
  f.legal !== "all" ||
  f.scope !== SCOPE_ALL;

/** Một dòng lịch sử có nằm trong phạm vi đang chọn không. */
export function matchesScope(r: AuctionHistoryRow, scope: string): boolean {
  if (scope === SCOPE_ALL) return true;
  if (scope.startsWith("unit:")) return r.unit_id === scope.slice(5);
  if (scope === "group:none") return !r.group_id;
  if (scope.startsWith("group:")) return r.group_id === scope.slice(6);
  return true;
}

/** Thứ tự vòng đời phiên — dropdown và biểu đồ không sắp theo bảng chữ cái. */
export const BUCKET_ORDER = ["Chờ đấu", "Đang đấu", "Đã thành", "Không thành", "Tồn đọng"];

export function filterHistory(rows: AuctionHistoryRow[], f: HistoryFilters): AuctionHistoryRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.bucket !== "all" && r.bucket !== f.bucket) return false;
    if (f.assetType !== "all" && r.asset_type !== f.assetType) return false;
    if (f.province !== "all" && r.province !== f.province) return false;
    if (f.legal !== "all" && r.legal_status !== f.legal) return false;
    if (!matchesScope(r, f.scope)) return false;
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      (r.province ?? "").toLowerCase().includes(q) ||
      (r.asset_type ?? "").toLowerCase().includes(q) ||
      (r.legal_status ?? "").toLowerCase().includes(q) ||
      (r.counterparty ?? "").toLowerCase().includes(q)
    );
  });
}

function distribute(
  rows: AuctionHistoryRow[],
  pick: (r: AuctionHistoryRow) => string | null,
  fallback: string,
  order?: string[],
): DistSlice[] {
  const acc = new Map<string, { count: number; value: number }>();
  for (const r of rows) {
    const label = pick(r) || fallback;
    const cur = acc.get(label) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(r.price ?? 0);
    acc.set(label, cur);
  }
  const total = rows.length;
  const out = [...acc.entries()].map(([label, v]) => ({
    label,
    count: v.count,
    value: v.value,
    pct: total ? Math.round((v.count / total) * 100) : 0,
  }));
  out.sort((a, b) =>
    order
      ? order.indexOf(a.label) - order.indexOf(b.label)
      : b.count - a.count || a.label.localeCompare(b.label, "vi"),
  );
  return out;
}

export interface HistoryAggregate {
  totals: {
    listings: number;
    startingPriceSum: number;
    avgPrice: number;
    provinces: number;
    assetTypes: number;
    won: number;
    stuck: number;
    winPriceSum: number;
    successRate: number;
  };
  /** Phân bổ theo đơn vị (trụ sở chính + chi nhánh). Rỗng nghĩa là không có
   *  chi nhánh nào — tab sẽ không vẽ biểu đồ này. */
  byUnit: DistSlice[];
  /** Phân bổ theo cụm; tin không thuộc cụm nào gom vào "Chưa xếp cụm". */
  byGroup: DistSlice[];
  byProvince: DistSlice[];
  byAssetType: DistSlice[];
  byLegal: DistSlice[];
  byStatus: DistSlice[];
  byCounterparty: CounterpartySlice[];
  byMonth: MonthPoint[];
}

export function aggregateHistory(rows: AuctionHistoryRow[]): HistoryAggregate {
  const total = rows.length;
  const startingPriceSum = rows.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const winPriceSum = rows.reduce((s, r) => s + Number(r.win_price ?? 0), 0);
  const won = rows.filter((r) => r.bucket === "Đã thành").length;
  const stuck = rows.filter((r) => r.bucket === "Tồn đọng").length;

  const cpAcc = new Map<string, { id: string | null; count: number; value: number }>();
  for (const r of rows) {
    const label = r.counterparty || "Chưa xác định";
    const cur = cpAcc.get(label) ?? { id: r.counterparty_id ?? null, count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(r.price ?? 0);
    cpAcc.set(label, cur);
  }
  const byCounterparty = [...cpAcc.entries()]
    .map(([label, v]) => ({
      id: v.id,
      label,
      count: v.count,
      value: v.value,
      pct: total ? Math.round((v.count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const monthAcc = new Map<string, { count: number; value: number }>();
  for (const r of rows) {
    const src = r.auction_at ?? r.created_at;
    if (!src) continue;
    const month = src.slice(0, 7);
    const cur = monthAcc.get(month) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(r.price ?? 0);
    monthAcc.set(month, cur);
  }
  const byMonth = [...monthAcc.entries()]
    .map(([month, v]) => ({ month, count: v.count, value: v.value }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    totals: {
      listings: total,
      startingPriceSum,
      avgPrice: total ? Math.round(startingPriceSum / total) : 0,
      provinces: new Set(rows.map((r) => r.province).filter(Boolean)).size,
      assetTypes: new Set(rows.map((r) => r.asset_type).filter(Boolean)).size,
      won,
      stuck,
      winPriceSum,
      successRate: total ? Math.round((won / total) * 100) : 0,
    },
    byUnit: distribute(rows, (r) => r.unit_name, "Không xác định"),
    byGroup: distribute(rows, (r) => r.group_name, UNGROUPED_LABEL),
    byProvince: distribute(rows, (r) => r.province, "Không xác định"),
    byAssetType: distribute(rows, (r) => r.asset_type, "Không xác định"),
    byLegal: distribute(rows, (r) => r.legal_status, "Không xác định"),
    byStatus: distribute(rows, (r) => r.bucket, "Không xác định", BUCKET_ORDER),
    byCounterparty,
    byMonth,
  };
}

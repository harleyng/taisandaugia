// Thu tiền + Dòng tiền (docs/owner-control-tower-plan.md Phase 15a, tách hai trang 2026-09-27):
//   - "Thu tiền"  /chu-tai-san/thu-tien  — tác nghiệp, TÍNH ĐẾN HÔM NAY: khoản còn phải thu
//     theo hạn + sổ đã ghi. Không có kỳ.
//   - "Dòng tiền" /chu-tai-san/dong-tien — báo cáo THEO KỲ: mọi con số (hero, thác tiền, theo
//     đơn vị) chỉ tính các tài sản BÁN trong kỳ (theo ngày phiên) ⇒ Đã thu + Còn phải thu = Giá trúng.
//     Riêng "Dự báo tiền về" vẫn tính từ hôm nay (người dùng giữ lại dù design bỏ).
//
// Đọc MỘT payload của RPC owner_cash_flow: các đơn vị (Trạm + các Trạm con nếu là
// trụ sở), các dòng "Kết quả phiên", sổ thu chi và phiên sắp tới. Server đã gộp
// nguồn; module này chỉ cộng tổng / dựng biểu đồ (thuần, không React).
//
// Hai nghĩa của "đã thu" — đừng lẫn:
//   1. Dòng tiền của kỳ  = các phiên BÁN trong kỳ, số đã thu tới hôm nay, chỉ tài sản đơn vị
//                          tự theo dõi tiền; tính bằng recoveryOf() như Chỉ tiêu.
//   2. Chỉ tiêu "Đã thu" = mọi tài sản bán trong kỳ (kể cả nguồn không theo dõi tiền), trước phí.

import {
  OUTCOME_CONFIDENCES,
  OUTCOME_PAYMENT_STATUSES,
  OUTCOME_SOURCE_KINDS,
  RESOLVED_OUTCOME_KINDS,
  type OutcomeConfidence,
  type OutcomePaymentStatus,
  type OutcomeSourceKind,
  type ResolvedOutcomeKind,
} from "@/lib/ownerOutcomes";
import { summarizeOutcomes } from "@/lib/ownerOutcomesOverview";
import { inPeriod, periodRange, PERIOD_LAST_12M, type DateRange } from "@/lib/ownerPeriods";
import { dayDiff } from "@/lib/ownerPulse";
import { recoveryOf } from "@/lib/ownerTargets";
import { CASH_KIND_SIGN, isCashKind, type CashKind } from "@/lib/ownerCashEvent";
import { stripViDiacritics } from "@/lib/normalizeVi";

/** Hạn thanh toán mặc định khi cán bộ chưa đặt — như payment_due_at của phiên trên sàn. */
export const DEFAULT_PAYMENT_TERM_DAYS = 30;
/** Tiền của phiên sắp tới dự kiến về sau ngày phiên bấy nhiêu ngày. */
export const ESTIMATE_CASH_LAG_DAYS = 30;
/** Cần ít nhất bấy nhiêu kết quả trong 12 tháng mới ước tính theo tỷ lệ thành công. */
export const ESTIMATE_MIN_RESULTS = 3;

// ─── Kiểu ────────────────────────────────────────────────────────────────────

export interface CashUnit {
  id: string;
  name: string;
  isSelf: boolean;
  /** Người xem là thành viên trực tiếp ⇒ thấy tên người ghi sổ. */
  canSeePeople: boolean;
}

/** Một tài sản có kết quả (cùng dòng với "Kết quả phiên"). */
export interface CashRow {
  unitId: string;
  rowKey: string;
  listingId: string | null;
  ownOutcomeId: string | null;
  bestKind: OutcomeSourceKind | null;
  title: string;
  assetCode: string | null;
  branchId: string | null;
  branchName: string | null;
  outcome: ResolvedOutcomeKind | null;
  date: string | null;
  startingPrice: number | null;
  price: number | null;
  paymentStatus: OutcomePaymentStatus | null;
  paidAmount: number | null;
  paymentDueOn: string | null;
  confidence: OutcomeConfidence | null;
}

export interface CashEvent {
  id: string;
  unitId: string;
  outcomeId: string;
  rowKey: string;
  title: string;
  assetCode: string | null;
  branchId: string | null;
  branchName: string | null;
  roundNo: number | null;
  /** Kết quả HIỆN TẠI của lượt mà khoản gắn vào. */
  outcome: ResolvedOutcomeKind | null;
  kind: CashKind;
  amount: number;
  occurredOn: string;
  note: string | null;
  updatedAt: string | null;
  createdByName: string | null;
  updatedByName: string | null;
}

export interface CashUpcoming {
  unitId: string;
  rowKey: string;
  title: string;
  assetCode: string | null;
  branchId: string | null;
  branchName: string | null;
  auctionDate: string;
  orgName: string | null;
  startingPrice: number | null;
}

export interface CashFlowData {
  /** Hôm nay theo giờ Việt Nam (server). */
  asOf: string;
  units: CashUnit[];
  rows: CashRow[];
  events: CashEvent[];
  upcoming: CashUpcoming[];
}

// ─── Đọc payload ─────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const day = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function oneOf<T extends string>(allowed: readonly T[], v: unknown): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

const UNTITLED = "Tài sản chưa đặt tên";

export function mapCashFlowPayload(raw: unknown): CashFlowData {
  const p = obj(raw);
  const units = arr(p.units).flatMap((u): CashUnit[] => {
    const r = obj(u);
    const id = str(r.id);
    return id
      ? [{ id, name: str(r.name) ?? "Đơn vị", isSelf: r.is_self === true, canSeePeople: r.can_see_people === true }]
      : [];
  });
  const rows = arr(p.rows).flatMap((x): CashRow[] => {
    const r = obj(x);
    const unitId = str(r.unit_id);
    const rowKey = str(r.row_key);
    if (!unitId || !rowKey) return [];
    return [
      {
        unitId,
        rowKey,
        listingId: str(r.listing_id),
        ownOutcomeId: str(r.own_outcome_id),
        bestKind: oneOf(OUTCOME_SOURCE_KINDS, r.best_kind),
        title: str(r.asset_title) ?? UNTITLED,
        assetCode: str(r.asset_code),
        branchId: str(r.branch_id),
        branchName: str(r.branch_name),
        outcome: oneOf(RESOLVED_OUTCOME_KINDS, r.resolved_outcome),
        date: day(r.resolved_date),
        startingPrice: num(r.starting_price),
        price: num(r.resolved_price),
        paymentStatus: oneOf(OUTCOME_PAYMENT_STATUSES, r.payment_status),
        paidAmount: num(r.paid_amount),
        paymentDueOn: day(r.payment_due_on),
        confidence: oneOf(OUTCOME_CONFIDENCES, r.confidence_label),
      },
    ];
  });
  const events = arr(p.events).flatMap((x): CashEvent[] => {
    const r = obj(x);
    const id = str(r.id);
    const unitId = str(r.unit_id);
    const outcomeId = str(r.outcome_id);
    const occurredOn = day(r.occurred_on);
    const amount = num(r.amount);
    if (!id || !unitId || !outcomeId || !occurredOn || amount === null || !isCashKind(r.kind)) return [];
    return [
      {
        id,
        unitId,
        outcomeId,
        rowKey: str(r.row_key) ?? `o:${outcomeId}`,
        title: str(r.asset_title) ?? UNTITLED,
        assetCode: str(r.asset_code),
        branchId: str(r.branch_id),
        branchName: str(r.branch_name),
        roundNo: num(r.round_no),
        outcome: oneOf(RESOLVED_OUTCOME_KINDS, r.outcome),
        kind: r.kind,
        amount,
        occurredOn,
        note: str(r.note),
        updatedAt: str(r.updated_at),
        createdByName: str(r.created_by_name),
        updatedByName: str(r.updated_by_name),
      },
    ];
  });
  const upcoming = arr(p.upcoming).flatMap((x): CashUpcoming[] => {
    const r = obj(x);
    const unitId = str(r.unit_id);
    const rowKey = str(r.row_key);
    const auctionDate = day(r.auction_date);
    if (!unitId || !rowKey || !auctionDate) return [];
    return [
      {
        unitId,
        rowKey,
        title: str(r.asset_title) ?? UNTITLED,
        assetCode: str(r.asset_code),
        branchId: str(r.branch_id),
        branchName: str(r.branch_name),
        auctionDate,
        orgName: str(r.org_name),
        startingPrice: num(r.starting_price),
      },
    ];
  });
  return { asOf: day(p.as_of) ?? new Date().toISOString().slice(0, 10), units, rows, events, upcoming };
}

// ─── Phạm vi (trụ sở: toàn hệ thống / từng đơn vị) ───────────────────────────

export const SCOPE_ALL = "all";

/** Tham số URL lạ hoặc đơn vị không còn trong payload ⇒ toàn bộ. */
export function resolveScope(param: string | null | undefined, units: CashUnit[]): string {
  return param && units.some((u) => u.id === param) ? param : SCOPE_ALL;
}

export function scopeData(data: CashFlowData, scope: string): CashFlowData {
  if (scope === SCOPE_ALL) return data;
  const keep = <T extends { unitId: string }>(xs: T[]) => xs.filter((x) => x.unitId === scope);
  return {
    ...data,
    units: data.units.filter((u) => u.id === scope),
    rows: keep(data.rows),
    events: keep(data.events),
    upcoming: keep(data.upcoming),
  };
}

// ─── Tiện ích ngày ───────────────────────────────────────────────────────────

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const unitKey = (unitId: string, rowKey: string) => `${unitId}|${rowKey}`;

/** Đơn vị tự theo dõi tiền của tài sản: nguồn thắng là bản tự khai của chính đơn vị. */
export const isTracked = (row: Pick<CashRow, "bestKind" | "ownOutcomeId">) =>
  row.bestKind === "owner_report" && row.ownOutcomeId !== null;

/** Hạn thanh toán: cán bộ đặt, không thì ngày phiên + 30; null khi tài sản không có ngày phiên. */
const paymentDueOf = (r: CashRow): string | null =>
  r.paymentDueOn ?? (r.date ? addDays(r.date, DEFAULT_PAYMENT_TERM_DAYS) : null);

const recoveryOfRow = (r: CashRow) =>
  recoveryOf({ day: r.date, branchId: r.branchId, price: r.price, paymentStatus: r.paymentStatus, paidAmount: r.paidAmount });

// ─── 1. Thác tiền của các phiên bán trong kỳ ─────────────────────────────────

export interface WaterfallTotals {
  /** Tài sản trong thác (tự theo dõi tiền, đã bán, không bỏ cọc). */
  count: number;
  starting: number;
  /** Giá trúng − giá khởi điểm (âm nếu bán dưới giá khởi điểm). */
  premium: number;
  winning: number;
  /** Còn phải thu. */
  awaiting: number;
  /** Đã thu, tính tới hôm nay (không vượt giá trúng). */
  recorded: number;
  /** Phí & chi phí của các tài sản này (mọi lượt). */
  fees: number;
  net: number;
  notes: {
    /** Thiếu giá khởi điểm ⇒ coi như bằng giá trúng. */
    missingStart: number;
    defaulted: number;
    /** Bán trên sàn — sàn theo dõi thanh toán. */
    platform: { count: number; value: number };
    /** Kết quả từ nguồn khác (tổ chức / tin cào) — đơn vị chưa khai nên không theo dõi tiền. */
    untracked: { count: number; value: number };
    /** Thu vượt giá trúng (không vẽ, chỉ nhắc). */
    overpaid: number;
  };
}

export function cohortWaterfall(rows: CashRow[], events: CashEvent[], range: DateRange | null): WaterfallTotals {
  const w: WaterfallTotals = {
    count: 0,
    starting: 0,
    premium: 0,
    winning: 0,
    awaiting: 0,
    recorded: 0,
    fees: 0,
    net: 0,
    notes: { missingStart: 0, defaulted: 0, platform: { count: 0, value: 0 }, untracked: { count: 0, value: 0 }, overpaid: 0 },
  };
  const cohort = new Set<string>();
  for (const r of rows) {
    if (r.outcome !== "sold" || !inPeriod(r.date, range)) continue;
    const price = r.price !== null && r.price > 0 ? r.price : 0;
    if (!isTracked(r)) {
      const bucket = r.bestKind === "platform" ? w.notes.platform : w.notes.untracked;
      bucket.count += 1;
      bucket.value += price;
      continue;
    }
    const parts = recoveryOfRow(r);
    if (!parts.counted) {
      w.notes.defaulted += 1;
      continue;
    }
    cohort.add(unitKey(r.unitId, r.rowKey));
    const recorded = Math.min(parts.recorded, price);
    w.notes.overpaid += Math.max(0, parts.recorded - price);
    const starting = r.startingPrice !== null && r.startingPrice > 0 ? r.startingPrice : price;
    if (r.startingPrice === null || r.startingPrice <= 0) w.notes.missingStart += 1;
    w.count += 1;
    w.starting += starting;
    w.winning += price;
    w.recorded += recorded;
    w.awaiting += price - recorded;
  }
  for (const e of events) {
    if (e.kind === "fee" && cohort.has(unitKey(e.unitId, e.rowKey))) w.fees += e.amount;
  }
  w.premium = w.winning - w.starting;
  w.net = w.recorded - w.fees;
  return w;
}

export type WaterfallStepKind = "total" | "down";

export interface WaterfallStep {
  key: "winning" | "awaiting" | "recorded" | "fees" | "net";
  label: string;
  kind: WaterfallStepKind;
  /** Đoạn [thấp, cao] của thanh nổi. */
  range: [number, number];
  /** Giá trị hiển thị (âm với bước giảm). */
  value: number;
}

/** "Từ giá trúng đến thực nhận" (design 2026-09-27): bỏ bậc giá khởi điểm / chênh lệch trả giá. */
export function waterfallSteps(w: WaterfallTotals): WaterfallStep[] {
  const span = (a: number, b: number): [number, number] => [Math.min(a, b), Math.max(a, b)];
  return [
    { key: "winning", label: "Giá trúng", kind: "total", range: span(0, w.winning), value: w.winning },
    { key: "awaiting", label: "Chưa thu", kind: "down", range: span(w.recorded, w.winning), value: -w.awaiting },
    { key: "recorded", label: "Đã thu", kind: "total", range: span(0, w.recorded), value: w.recorded },
    { key: "fees", label: "Phí & chi phí", kind: "down", range: span(w.net, w.recorded), value: -w.fees },
    { key: "net", label: "Thực nhận", kind: "total", range: span(0, w.net), value: w.net },
  ];
}

/** Tỷ lệ thu = đã thu / giá trúng của các phiên bán trong kỳ; null khi chưa có giá trúng. */
export const recoveryRate = (w: Pick<WaterfallTotals, "recorded" | "winning">): number | null =>
  w.winning > 0 ? w.recorded / w.winning : null;

// ─── 2. Khoản phải thu (tính tới hôm nay) ────────────────────────────────────

export interface Receivable {
  row: CashRow;
  remaining: number;
  /** Hạn thanh toán; null khi tài sản không có ngày phiên. */
  dueOn: string | null;
  /** Hạn mặc định (ngày phiên + 30), cán bộ chưa đặt. */
  dueIsDefault: boolean;
  /** > 0 ⇒ quá hạn bấy nhiêu ngày. */
  daysOverdue: number;
}

export function receivables(rows: CashRow[], asOf: string): Receivable[] {
  const list: Receivable[] = [];
  for (const r of rows) {
    if (r.outcome !== "sold" || !isTracked(r)) continue;
    const parts = recoveryOfRow(r);
    if (!parts.counted || parts.awaiting <= 0) continue;
    const dueOn = paymentDueOf(r);
    list.push({
      row: r,
      remaining: parts.awaiting,
      dueOn,
      dueIsDefault: r.paymentDueOn === null,
      daysOverdue: dueOn ? Math.max(0, dayDiff(dueOn, asOf)) : 0,
    });
  }
  return list.sort(
    (a, b) =>
      b.daysOverdue - a.daysOverdue ||
      (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") ||
      a.row.title.localeCompare(b.row.title, "vi"),
  );
}

// ─── 3. Thu tiền: ba nhóm theo hạn ───────────────────────────────────────────

/** "Đến hạn trong 7 ngày" gồm cả hạn hôm nay (0) tới hết ngày thứ 7. */
export const DUE_SOON_DAYS = 7;

export const COLLECTION_BUCKETS = ["overdue", "soon", "later"] as const;
export type CollectionBucketKey = (typeof COLLECTION_BUCKETS)[number];

export const COLLECTION_BUCKET_LABEL: Record<CollectionBucketKey, string> = {
  overdue: "Quá hạn",
  soon: `Đến hạn trong ${DUE_SOON_DAYS} ngày`,
  later: "Còn hạn",
};

/** Số ngày tới hạn (âm = đã trễ, 0 = hôm nay); null khi chưa có hạn. */
export const daysUntilDue = (r: Receivable, asOf: string): number | null => (r.dueOn ? dayDiff(asOf, r.dueOn) : null);

/** Khoản chưa có hạn (tài sản không có ngày phiên) xếp vào "Còn hạn". */
export function collectionBucketOf(r: Receivable, asOf: string): CollectionBucketKey {
  if (r.daysOverdue > 0) return "overdue";
  const d = daysUntilDue(r, asOf);
  return d !== null && d <= DUE_SOON_DAYS ? "soon" : "later";
}

export interface CollectionBucket {
  key: CollectionBucketKey;
  label: string;
  count: number;
  amount: number;
}

export function collectionBuckets(recv: Receivable[], asOf: string): CollectionBucket[] {
  const buckets = COLLECTION_BUCKETS.map((key) => ({ key, label: COLLECTION_BUCKET_LABEL[key], count: 0, amount: 0 }));
  for (const r of recv) {
    const b = buckets.find((x) => x.key === collectionBucketOf(r, asOf))!;
    b.count += 1;
    b.amount += r.remaining;
  }
  return buckets;
}

/**
 * Quyền ghi của người xem trên một dòng (đơn vị của mình + phạm vi chi nhánh), theo
 * thao tác của module Thu tiền: ghi khoản thu (mặc định) / sửa (kể cả hạn, bỏ cọc) / xoá.
 */
export type CanWriteRow = (unitId: string, branchId: string | null, action?: "create" | "update" | "delete") => boolean;

/** Khoản quá hạn mà người xem ghi thu được (dòng chi nhánh của trụ sở chỉ xem). */
export function writableOverdueCount(data: CashFlowData, canWrite: CanWriteRow): number {
  return receivables(data.rows, data.asOf).filter(
    (r) => r.daysOverdue > 0 && r.row.ownOutcomeId !== null && canWrite(r.row.unitId, r.row.branchId),
  ).length;
}

// ─── 4. Ước tính từ phiên sắp tới ────────────────────────────────────────────

export interface UnitSuccessRate {
  unitId: string;
  results: number;
  sold: number;
  /** null ⇒ chưa đủ dữ liệu (< ESTIMATE_MIN_RESULTS kết quả trong 12 tháng). */
  rate: number | null;
}

/** Tỷ lệ thành công 12 tháng của mỗi đơn vị — cùng định nghĩa "Kết quả phiên" (bán / có kết quả). */
export function unitSuccessRates(rows: CashRow[], units: CashUnit[], asOf: string): Map<string, UnitSuccessRate> {
  const range = periodRange(PERIOD_LAST_12M, asOf);
  const out = new Map<string, UnitSuccessRate>();
  for (const u of units) {
    const mine = rows.filter((r) => r.unitId === u.id && r.outcome !== null && inPeriod(r.date, range));
    const t = summarizeOutcomes(
      mine.map((r) => ({ outcome: r.outcome, price: r.price, paymentStatus: r.paymentStatus, hasConflict: false })),
    );
    out.set(u.id, {
      unitId: u.id,
      results: t.total,
      sold: t.sold,
      rate: t.total >= ESTIMATE_MIN_RESULTS ? t.sold / t.total : null,
    });
  }
  return out;
}

export interface EstimateItem {
  upcoming: CashUpcoming;
  expected: number;
  cashOn: string;
}

export interface EstimateLayer {
  items: EstimateItem[];
  total: number;
  /** Phiên sắp tới không ước tính được: đơn vị chưa đủ dữ liệu / thiếu giá khởi điểm. */
  skippedNoRate: number;
  skippedNoPrice: number;
}

export function estimateLayer(upcoming: CashUpcoming[], rates: Map<string, UnitSuccessRate>): EstimateLayer {
  const layer: EstimateLayer = { items: [], total: 0, skippedNoRate: 0, skippedNoPrice: 0 };
  for (const u of upcoming) {
    const rate = rates.get(u.unitId)?.rate ?? null;
    if (rate === null) {
      layer.skippedNoRate += 1;
      continue;
    }
    if (u.startingPrice === null || u.startingPrice <= 0) {
      layer.skippedNoPrice += 1;
      continue;
    }
    const expected = Math.round(u.startingPrice * rate);
    layer.items.push({ upcoming: u, expected, cashOn: addDays(u.auctionDate, ESTIMATE_CASH_LAG_DAYS) });
    layer.total += expected;
  }
  return layer;
}

// ─── 5. Dự báo 30 / 60 / 90 ngày ─────────────────────────────────────────────

export type ForecastBucketKey = "overdue" | "d30" | "d60" | "d90";

export const FORECAST_BUCKET_LABEL: Record<ForecastBucketKey, string> = {
  overdue: "Quá hạn",
  d30: "Trong 30 ngày",
  d60: "31–60 ngày",
  d90: "61–90 ngày",
};

export interface ForecastBucket {
  key: ForecastBucketKey;
  label: string;
  /** Tiền còn phải thu của tài sản đã bán (có hạn trong khoảng). */
  owed: number;
  /** Ước tính từ phiên sắp tới. */
  estimate: number;
}

export interface Forecast {
  buckets: ForecastBucket[];
  /** Phải thu có hạn sau 90 ngày / không rõ hạn — không vẽ, chỉ nhắc. */
  laterOwed: number;
  undatedOwed: number;
}

function bucketOf(dueOn: string, asOf: string): ForecastBucketKey | null {
  const d = dayDiff(asOf, dueOn);
  if (d < 0) return "overdue";
  if (d <= 30) return "d30";
  if (d <= 60) return "d60";
  if (d <= 90) return "d90";
  return null;
}

export function cashForecast(recv: Receivable[], estimate: EstimateLayer, asOf: string): Forecast {
  const buckets: ForecastBucket[] = (["overdue", "d30", "d60", "d90"] as const).map((key) => ({
    key,
    label: FORECAST_BUCKET_LABEL[key],
    owed: 0,
    estimate: 0,
  }));
  const at = (k: ForecastBucketKey) => buckets.find((b) => b.key === k)!;
  const f: Forecast = { buckets, laterOwed: 0, undatedOwed: 0 };
  for (const r of recv) {
    if (!r.dueOn) {
      f.undatedOwed += r.remaining;
      continue;
    }
    const k = bucketOf(r.dueOn, asOf);
    if (k) at(k).owed += r.remaining;
    else f.laterOwed += r.remaining;
  }
  for (const e of estimate.items) {
    const k = bucketOf(e.cashOn, asOf);
    // Tiền ước tính không bao giờ "quá hạn": phiên còn ở phía trước.
    if (k && k !== "overdue") at(k).estimate += e.expected;
  }
  return f;
}

// ─── 6. Dòng tiền: từng tài sản bán trong kỳ + theo đơn vị ───────────────────

/** Một tài sản bán trong kỳ mà đơn vị tự theo dõi tiền — dòng của file Excel. */
export interface CohortAsset {
  row: CashRow;
  /** Người trúng bỏ cọc ⇒ không tính vào thác tiền. */
  defaulted: boolean;
  /** Đã thu tới hôm nay (không vượt giá trúng). */
  recorded: number;
  awaiting: number;
  dueOn: string | null;
  daysOverdue: number;
}

/** Cùng tập tài sản với cohortWaterfall (kể cả bỏ cọc, để báo cáo liệt kê đủ). */
export function cohortAssets(rows: CashRow[], range: DateRange | null, asOf: string): CohortAsset[] {
  const out: CohortAsset[] = [];
  for (const r of rows) {
    if (r.outcome !== "sold" || !isTracked(r) || !inPeriod(r.date, range)) continue;
    const parts = recoveryOfRow(r);
    const price = r.price !== null && r.price > 0 ? r.price : 0;
    const dueOn = paymentDueOf(r);
    const awaiting = parts.counted ? parts.awaiting : 0;
    out.push({
      row: r,
      defaulted: !parts.counted,
      recorded: Math.min(parts.recorded, price),
      awaiting,
      dueOn,
      daysOverdue: awaiting > 0 && dueOn ? Math.max(0, dayDiff(dueOn, asOf)) : 0,
    });
  }
  return out.sort(
    (a, b) => (b.row.date ?? "").localeCompare(a.row.date ?? "") || a.row.title.localeCompare(b.row.title, "vi"),
  );
}

export interface UnitRecovery {
  unit: CashUnit;
  totals: WaterfallTotals;
  /** Phần "Còn phải thu" đã quá hạn. */
  overdue: number;
  overdueCount: number;
  rate: number | null;
}

/** Bảng "Theo đơn vị" của trụ sở — cùng tập tài sản bán trong kỳ với hero và thác tiền. */
export function unitRecovery(data: CashFlowData, range: DateRange | null): UnitRecovery[] {
  const late = cohortAssets(data.rows, range, data.asOf).filter((a) => a.daysOverdue > 0);
  return data.units.map((unit) => {
    const totals = cohortWaterfall(
      data.rows.filter((r) => r.unitId === unit.id),
      data.events.filter((e) => e.unitId === unit.id),
      range,
    );
    const mine = late.filter((a) => a.row.unitId === unit.id);
    return {
      unit,
      totals,
      overdue: mine.reduce((s, a) => s + a.awaiting, 0),
      overdueCount: mine.length,
      rate: recoveryRate(totals),
    };
  });
}

// ─── Dựng trọn một màn ───────────────────────────────────────────────────────

/** Trang "Thu tiền" — tính đến hôm nay, không có kỳ. */
export interface CollectionsView {
  asOf: string;
  receivables: Receivable[];
  buckets: CollectionBucket[];
  /** Mọi khoản đã ghi, mới nhất trước (ngày tiền về, rồi lần sửa). */
  ledger: CashEvent[];
}

export function buildCollectionsView(data: CashFlowData): CollectionsView {
  const recv = receivables(data.rows, data.asOf);
  return {
    asOf: data.asOf,
    receivables: recv,
    buckets: collectionBuckets(recv, data.asOf),
    ledger: [...data.events].sort(
      (a, b) => b.occurredOn.localeCompare(a.occurredOn) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    ),
  };
}

/** Ô "Tìm tài sản…": theo tên (bỏ dấu) hoặc mã tài sản. */
export function matchesAssetQuery(item: { title: string; assetCode: string | null }, query: string): boolean {
  const q = stripViDiacritics(query);
  if (!q) return true;
  return stripViDiacritics(item.title).includes(q) || (item.assetCode ?? "").toLowerCase().includes(q);
}

/** Trang "Dòng tiền" — báo cáo theo kỳ (dự báo vẫn tính từ hôm nay). */
export interface CashReportView {
  asOf: string;
  range: DateRange | null;
  waterfall: WaterfallTotals;
  steps: WaterfallStep[];
  rate: number | null;
  units: UnitRecovery[];
  estimate: EstimateLayer;
  forecast: Forecast;
}

export function buildCashReportView(data: CashFlowData, periodId: string): CashReportView {
  const range = periodRange(periodId, data.asOf);
  const waterfall = cohortWaterfall(data.rows, data.events, range);
  const estimate = estimateLayer(data.upcoming, unitSuccessRates(data.rows, data.units, data.asOf));
  return {
    asOf: data.asOf,
    range,
    waterfall,
    steps: waterfallSteps(waterfall),
    rate: recoveryRate(waterfall),
    units: unitRecovery(data, range),
    estimate,
    forecast: cashForecast(receivables(data.rows, data.asOf), estimate, data.asOf),
  };
}

/** Tài sản bán trong kỳ của một đơn vị mà đơn vị chưa tự khai (nguồn tổ chức / tin cào) — CTA "Khai kết quả". */
export function untrackedSoldOf(rows: CashRow[], unitId: string | null, range: DateRange | null): CashRow[] {
  return rows.filter(
    (r) => r.unitId === unitId && r.outcome === "sold" && !isTracked(r) && r.bestKind !== "platform" && inPeriod(r.date, range),
  );
}

/** Các kết quả phiên CỦA CHÍNH đơn vị có thể gắn khoản thu chi (lượt mới nhất của mỗi tài sản). */
export function recordableRows(data: CashFlowData): CashRow[] {
  const self = data.units.find((u) => u.isSelf)?.id;
  return data.rows
    .filter((r) => r.unitId === self && isTracked(r))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title, "vi"));
}

/** Số đã thu của MỘT lượt, dựng lại từ sổ (cùng luật trigger: tiền về − hoàn trả, không âm). */
export function collectedOf(events: CashEvent[], outcomeId: string): number {
  let sum = 0;
  for (const e of events) {
    if (e.outcomeId !== outcomeId || e.kind === "fee") continue;
    sum += CASH_KIND_SIGN[e.kind] * e.amount;
  }
  return Math.max(0, sum);
}

/**
 * Bối cảnh kiểm số cho biểu mẫu thu chi của một lượt. Lượt mới nhất của tài sản đơn vị
 * tự theo dõi ⇒ có giá trúng + cờ bỏ cọc; lượt cũ (chỉ thấy qua sổ) ⇒ không chặn trần.
 */
export function outcomeCashContext(
  data: CashFlowData,
  outcomeId: string,
): { sold: boolean; defaulted: boolean; winningPrice: number | null; collected: number } {
  const row = data.rows.find((r) => r.ownOutcomeId === outcomeId && isTracked(r));
  const outcome = row?.outcome ?? data.events.find((e) => e.outcomeId === outcomeId)?.outcome ?? null;
  return {
    sold: outcome === "sold",
    defaulted: row?.paymentStatus === "defaulted",
    winningPrice: row?.price ?? null,
    collected: collectedOf(data.events, outcomeId),
  };
}

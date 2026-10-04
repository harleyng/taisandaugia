// "Đối tác của tôi" — bảng điểm đối tác của Trạm (docs/owner-dossier-plan.md §A7, Phase 5).
//
// Số liệu do RPC owner_partner_scorecard tính (migration 20261001250000). File này chỉ
// thu hẹp kiểu, chọn chỉ số theo loại đối tác và áp ngưỡng "Chưa đủ dữ liệu" — không tính lại.

import { formatMoneyShort } from "@/utils/money";
import type { AuthVerdict, DossierKind } from "./types";

/** Chỉ số chỉ hiện khi đối tác có ít nhất chừng này hồ sơ đã có kết quả (§A7). */
export const MIN_OUTCOMES_FOR_METRICS = 3;

export const NOT_ENOUGH_DATA = "Chưa đủ dữ liệu";

export const PARTNER_KINDS: DossierKind[] = ["appraisal", "authentication", "legal", "auction"];

export type PartnerAssetOutcome = "sold" | "unsold" | "postponed" | "cancelled" | "withdrawn";

export interface PartnerAsset {
  postingId: string;
  code: string | null;
  title: string;
  /** null = chưa có kết quả phiên nào. */
  outcome: PartnerAssetOutcome | null;
  rounds: number;
  soldPrice: number | null;
  appraisedValue: number | null;
  lastDate: string | null;
  legalIssue: boolean;
  /** Chỉ đối tác giám định: kết luận đối tác ghi trên hồ sơ. */
  authVerdict: AuthVerdict | null;
}

export interface PartnerScore {
  kind: DossierKind;
  key: string;
  orgId: string | null;
  name: string;
  assets: number;
  assetsWithOutcome: number;
  soldAssets: number;
  medianDeviation: number | null;
  unsold2PlusRate: number | null;
  legalIssueAssets: number;
  successRate: number | null;
  avgRoundsToSell: number | null;
  avgParticipants: number | null;
  assetList: PartnerAsset[];
  /** Chỉ đối tác giám định — đếm từ assetList. */
  authenticAssets: number;
  flaggedAssets: number;
}

const KINDS = new Set<string>(PARTNER_KINDS);
const OUTCOMES = new Set<string>(["sold", "unsold", "postponed", "cancelled", "withdrawn"]);
const VERDICTS = new Set<string>(["authentic", "inconclusive", "suspected_fake"]);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

function mapAsset(raw: unknown): PartnerAsset | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const postingId = str(r.posting_id);
  if (!postingId) return null;
  const outcome = str(r.outcome);
  return {
    postingId,
    code: str(r.code),
    title: str(r.title) ?? "Hồ sơ chưa đặt tên",
    outcome: outcome && OUTCOMES.has(outcome) ? (outcome as PartnerAssetOutcome) : null,
    rounds: num(r.rounds) ?? 0,
    soldPrice: num(r.sold_price),
    appraisedValue: num(r.appraised_value),
    lastDate: str(r.last_date),
    legalIssue: r.legal_issue === true,
    authVerdict: VERDICTS.has(str(r.auth_verdict) ?? "") ? (r.auth_verdict as AuthVerdict) : null,
  };
}

/** Một dòng RPC → PartnerScore; dòng loại lạ bị bỏ (null). */
export function mapPartnerScore(row: Record<string, unknown>): PartnerScore | null {
  const kind = str(row.kind);
  const key = str(row.partner_key);
  if (!kind || !KINDS.has(kind) || !key) return null;
  const list = Array.isArray(row.asset_list) ? row.asset_list : [];
  const assetList = list.map(mapAsset).filter((a): a is PartnerAsset => a !== null);
  return {
    kind: kind as DossierKind,
    key,
    orgId: str(row.partner_org_id),
    name: str(row.partner_name) ?? "Đối tác chưa đặt tên",
    assets: num(row.assets) ?? 0,
    assetsWithOutcome: num(row.assets_with_outcome) ?? 0,
    soldAssets: num(row.sold_assets) ?? 0,
    medianDeviation: num(row.median_deviation),
    unsold2PlusRate: num(row.unsold_2plus_rate),
    legalIssueAssets: num(row.legal_issue_assets) ?? 0,
    successRate: num(row.success_rate),
    avgRoundsToSell: num(row.avg_rounds_to_sell),
    avgParticipants: num(row.avg_participants),
    assetList,
    authenticAssets: assetList.filter((a) => a.authVerdict === "authentic").length,
    flaggedAssets: assetList.filter((a) => a.authVerdict === "inconclusive" || a.authVerdict === "suspected_fake").length,
  };
}

/** Giám định chấm theo kết luận trên hồ sơ (không cần kết quả phiên) ⇒ ngưỡng tính theo số hồ sơ. */
export const hasEnoughData = (p: PartnerScore): boolean =>
  (p.kind === "authentication" ? p.assets : p.assetsWithOutcome) >= MIN_OUTCOMES_FOR_METRICS;

// ─── Chỉ số theo loại đối tác (§A7) ──────────────────────────────────────────

export interface PartnerMetric {
  label: string;
  value: (p: PartnerScore) => string;
}

const pct = (v: number | null): string => (v === null ? "—" : `${Math.round(v * 100)}%`);
const dec = (v: number | null): string =>
  v === null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: 1 });

export const PARTNER_METRICS: Record<DossierKind, PartnerMetric[]> = {
  appraisal: [
    {
      label: "Lệch giá trúng",
      value: (p) => pct(p.medianDeviation),
    },
    {
      label: "Ế ≥ 2 lượt",
      value: (p) => pct(p.unsold2PlusRate),
    },
  ],
  authentication: [
    {
      label: "Kết luận xác thực",
      value: (p) => `${p.authenticAssets.toLocaleString("en-US")} / ${p.assets.toLocaleString("en-US")}`,
    },
    {
      label: "Nghi ngờ / chưa đủ căn cứ",
      value: (p) => p.flaggedAssets.toLocaleString("en-US"),
    },
  ],
  legal: [
    {
      label: "Vướng pháp lý",
      value: (p) => `${p.legalIssueAssets.toLocaleString("en-US")} / ${p.assetsWithOutcome.toLocaleString("en-US")}`,
    },
  ],
  auction: [
    {
      label: "Tỉ lệ thành",
      value: (p) => pct(p.successRate),
    },
    {
      label: "Số lượt tới khi bán",
      value: (p) => dec(p.avgRoundsToSell),
    },
    {
      label: "Người tham gia / lượt",
      value: (p) => dec(p.avgParticipants),
    },
  ],
};

/** Giá trị hiển thị của một chỉ số — dưới ngưỡng thì "Chưa đủ dữ liệu". */
export function metricText(p: PartnerScore, m: PartnerMetric): string {
  return hasEnoughData(p) ? m.value(p) : NOT_ENOUGH_DATA;
}

export const PARTNER_KIND_INTRO: Record<DossierKind, string> = {
  appraisal: "So giá thẩm định của từng đơn vị với giá trúng thực tế.",
  authentication: "Kết luận giám định của từng đơn vị trên các hồ sơ bạn đã số hoá.",
  legal: "Tài sản qua tay từng đơn vị tư vấn pháp lý có bị vướng khi đưa ra đấu giá không.",
  auction: "Tỉ lệ bán thành, số lượt và mức độ quan tâm của người mua theo từng tổ chức đấu giá.",
};

// ─── Danh sách tài sản của một đối tác ──────────────────────────────────────

export const PARTNER_OUTCOME_LABEL: Record<PartnerAssetOutcome, string> = {
  sold: "Đã bán",
  unsold: "Không thành",
  postponed: "Hoãn",
  cancelled: "Huỷ phiên",
  withdrawn: "Rút khỏi phiên",
};

/** Lệch giữa giá trúng và giá thẩm định của MỘT tài sản: "+12%" / "−8%"; null khi không đủ số. */
export function assetDeviation(a: PartnerAsset): string | null {
  if (a.outcome !== "sold" || a.soldPrice === null || !a.appraisedValue) return null;
  const d = (a.soldPrice - a.appraisedValue) / a.appraisedValue;
  const v = Math.round(Math.abs(d) * 100);
  return v === 0 ? "0%" : `${d > 0 ? "+" : "−"}${v}%`;
}

export const money = (v: number | null): string => (v === null ? "—" : formatMoneyShort(v));

export function partnersOfKind(rows: readonly PartnerScore[], kind: DossierKind): PartnerScore[] {
  return rows.filter((r) => r.kind === kind);
}

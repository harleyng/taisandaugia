// Định dạng báo cáo "Tin đấu giá" từ JSONB của RPC admin_listings_report.
//
// Server đã tổng hợp sẵn (bucket theo date_trunc). Module này chỉ:
//  - zero-fill trục thời gian cho liên tục,
//  - gắn nhãn tiếng Việt cho trạng thái / nhóm tài sản / khoảng giá,
//  - chèn bucket giá còn thiếu để histogram luôn đủ cột,
//  - đẩy "Không rõ" xuống cuối bảng tỉnh.
// Module THUẦN: không import React / Supabase / lucide.

import {
  bucketKeyOf,
  enumerateBuckets,
  type Granularity,
} from "@/lib/reports/transactionReport";
import {
  SESSION_STATUS_LABELS,
  SESSION_STATUS_ORDER,
  type AuctionSessionStatus,
} from "@/lib/listings/sessionStatus";

// ─── Nhãn & taxonomy ─────────────────────────────────────────────────────────

export const PARENT_LABELS: Record<string, string> = {
  "bat-dong-san": "Bất động sản",
  "xe-co": "Xe cộ",
  "may-moc": "Máy móc",
  "hang-hoa": "Hàng hóa",
  "do-dung": "Đồ dùng",
  khac: "Khác / chưa phân nhóm",
};

/**
 * Map slug con → nhóm cha.
 *
 * ĐỒNG BỘ BẮT BUỘC với public.asset_parent_slug() trong
 * supabase/migrations/20260805000003_admin_listings_report.sql — sửa một bên
 * phải sửa bên kia, nếu không bộ lọc bảng chi tiết sẽ lệch với biểu đồ.
 *
 * DB chứa hai thế hệ taxonomy: bộ mới (ASSET_CATEGORIES trong
 * src/constants/category.constants.ts) và bộ cũ chỉ-BĐS từ property_types.
 * Không import ASSET_CATEGORIES ở đây vì nó kéo theo lucide-react.
 */
export const PARENT_OF: Record<string, string> = {
  // Bất động sản — thế hệ mới
  "dat-o": "bat-dong-san",
  "dat-nong-nghiep": "bat-dong-san",
  "nha-pho": "bat-dong-san",
  "can-ho": "bat-dong-san",
  "nha-xuong": "bat-dong-san",
  shophouse: "bat-dong-san",
  // Bất động sản — thế hệ cũ (property_types)
  "can-ho-chung-cu": "bat-dong-san",
  "chung-cu-mini-chdv": "bat-dong-san",
  "nha-rieng": "bat-dong-san",
  "biet-thu": "bat-dong-san",
  "nha-biet-thu": "bat-dong-san",
  "nha-lien-ke": "bat-dong-san",
  "nha-mat-pho": "bat-dong-san",
  "dat-nen-du-an": "bat-dong-san",
  "dat-nen": "bat-dong-san",
  "dat-tho-cu": "bat-dong-san",
  "trang-trai-khu-nghi-duong": "bat-dong-san",
  "kho-nha-xuong": "bat-dong-san",
  "kho-xuong": "bat-dong-san",
  condotel: "bat-dong-san",
  "cua-hang-kiot": "bat-dong-san",
  "nha-tro-phong-tro": "bat-dong-san",
  "van-phong": "bat-dong-san",
  "cac-loai-nha": "bat-dong-san",
  "cac-loai-dat": "bat-dong-san",
  "bds-khac": "bat-dong-san",
  // Các nhóm khác
  "o-to": "xe-co",
  "xe-tai": "xe-co",
  "xe-may": "xe-co",
  "may-cong-trinh": "may-moc",
  "may-nong-nghiep": "may-moc",
  "day-chuyen": "may-moc",
  "gach-vat-lieu": "hang-hoa",
  "sat-thep": "hang-hoa",
  "hang-ton-kho": "hang-hoa",
  "noi-that": "do-dung",
  "thiet-bi": "do-dung",
  "cong-cu": "do-dung",
};

/** Các slug cha có thể tự xuất hiện trong listings.property_type_slug. */
export const PARENT_SLUGS = [
  "bat-dong-san",
  "xe-co",
  "may-moc",
  "hang-hoa",
  "do-dung",
  "khac",
] as const;

export const parentOf = (slug: string): string =>
  (PARENT_SLUGS as readonly string[]).includes(slug) ? slug : (PARENT_OF[slug] ?? "khac");

/**
 * Dịch bộ lọc "nhóm cha" thành điều kiện cho query bảng chi tiết.
 * Nhóm "khac" là phần bù — mọi slug KHÔNG nằm trong danh sách đã biết.
 */
export function slugsForParent(parent: string): { inList?: string[]; excludeList?: string[] } {
  const known = [...PARENT_SLUGS.filter((p) => p !== "khac"), ...Object.keys(PARENT_OF)];
  if (parent === "khac") return { excludeList: known };
  const children = Object.entries(PARENT_OF)
    .filter(([, p]) => p === parent)
    .map(([slug]) => slug);
  return { inList: [parent, ...children] };
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  ACTIVE: "Đang hiển thị",
  INACTIVE: "Ngừng hiển thị",
  SOLD_RENTED: "Đã đấu giá xong",
};

/** Thứ tự theo vòng đời tin, không theo số lượng. */
export const STATUS_ORDER = ["DRAFT", "PENDING_APPROVAL", "ACTIVE", "INACTIVE", "SOLD_RENTED"];

export const PRICE_BUCKET_LABELS: Record<string, string> = {
  lt1: "< 1 tỷ",
  "1to5": "1 – 5 tỷ",
  "5to20": "5 – 20 tỷ",
  "20to100": "20 – 100 tỷ",
  gt100: "> 100 tỷ",
  unknown: "Chưa quy đổi",
};

/** Đúng thứ tự cột histogram; sort khớp cột `sort` của RPC. */
export const PRICE_BUCKET_ORDER = ["lt1", "1to5", "5to20", "20to100", "gt100", "unknown"];

export const COVERAGE_LABELS: { key: keyof RawCoverage; label: string }[] = [
  { key: "withImage", label: "Có ảnh" },
  { key: "withValue", label: "Có giá khởi điểm" },
  { key: "withAuctionAt", label: "Có ngày đấu giá" },
  { key: "withOrg", label: "Có tổ chức đấu giá" },
  { key: "withOwner", label: "Có chủ tài sản" },
  { key: "withProvince", label: "Có tỉnh/thành" },
  { key: "verified", label: "Đã xác minh" },
  { key: "featured", label: "Tin nổi bật" },
];

/**
 * Giá trị khởi điểm quy đổi ra VND.
 * BẢN SAO của public.listing_start_value() — PER_MONTH trả null vì giá
 * thuê/tháng không phải giá khởi điểm đấu giá, cộng vào tổng sẽ sai.
 */
export function startValueOf(
  price: number | string | null | undefined,
  unit: string | null | undefined,
  area: number | string | null | undefined,
): number | null {
  const p = Number(price ?? 0);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (unit === "PER_MONTH") return null;
  if (unit === "PER_SQM") {
    const a = Number(area ?? 0);
    return p * (Number.isFinite(a) && a !== 0 ? a : 1);
  }
  return p;
}

// ─── Shape JSONB trả về từ RPC ───────────────────────────────────────────────

interface RawCoverage {
  total: number;
  withImage: number;
  withValue: number;
  withAuctionAt: number;
  withOrg: number;
  withOwner: number;
  withProvince: number;
  verified: number;
  featured: number;
}

export interface RawListingsReport {
  kpis: {
    period: {
      listings: number;
      value: number;
      medianValue: number;
      valuedCount: number;
      orgs: number;
      owners: number;
      provinces: number;
      views: number;
    };
    total: { listings: number; active: number; pending: number; draft: number; value: number };
  };
  timeseries: { bucket: string; listings: number; value: number }[];
  byStatus: { status: string; listings: number; value: number }[];
  bySessionStatus: { session_status: string; listings: number; value: number }[];
  byCategory: { parent_slug: string; listings: number; value: number }[];
  byCategoryChild: {
    slug: string;
    name: string;
    parent_slug: string;
    listings: number;
    value: number;
  }[];
  byProvince: { province: string; listings: number; value: number }[];
  byPriceBucket: { bucket: string; sort: number; listings: number; value: number }[];
  topOrgs: { id: string; name: string; sub: string | null; listings: number; value: number }[];
  topOwners: { id: string; name: string; sub: string | null; listings: number; value: number }[];
  coverage: RawCoverage;
}

// ─── Kết quả đã định dạng cho UI ─────────────────────────────────────────────

export interface ListingsTimeBucket {
  key: string;
  label: string;
  listings: number;
  value: number;
}

export interface LabeledStat {
  key: string;
  label: string;
  listings: number;
  value: number;
}

export interface ProvinceListingStat {
  province: string;
  listings: number;
  value: number;
}

export interface CategoryChildStat {
  slug: string;
  name: string;
  parentSlug: string;
  parentLabel: string;
  listings: number;
  value: number;
}

export interface TopEntityStat {
  id: string;
  name: string;
  sub: string | null;
  listings: number;
  value: number;
}

export interface CoverageStat {
  key: string;
  label: string;
  count: number;
  total: number;
  pct: number;
}

export interface ListingsKpis {
  periodListings: number;
  periodValue: number;
  medianValue: number;
  valuedCount: number;
  orgs: number;
  owners: number;
  provinces: number;
  views: number;
  totalListings: number;
  totalActive: number;
  totalPending: number;
  totalDraft: number;
  totalValue: number;
}

export interface ListingsReport {
  kpis: ListingsKpis;
  timeSeries: ListingsTimeBucket[];
  byStatus: LabeledStat[];
  bySessionStatus: LabeledStat[];
  byCategory: LabeledStat[];
  byCategoryChild: CategoryChildStat[];
  byProvince: ProvinceListingStat[];
  byPriceBucket: LabeledStat[];
  topOrgs: TopEntityStat[];
  topOwners: TopEntityStat[];
  coverage: CoverageStat[];
}

const EMPTY_KPIS: ListingsKpis = {
  periodListings: 0,
  periodValue: 0,
  medianValue: 0,
  valuedCount: 0,
  orgs: 0,
  owners: 0,
  provinces: 0,
  views: 0,
  totalListings: 0,
  totalActive: 0,
  totalPending: 0,
  totalDraft: 0,
  totalValue: 0,
};

export const EMPTY_LISTINGS_REPORT: ListingsReport = {
  kpis: EMPTY_KPIS,
  timeSeries: [],
  byStatus: [],
  bySessionStatus: [],
  byCategory: [],
  byCategoryChild: [],
  byProvince: [],
  byPriceBucket: [],
  topOrgs: [],
  topOwners: [],
  coverage: [],
};

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// ─── Hàm định dạng chính ─────────────────────────────────────────────────────

export function formatListingsReport(
  raw: RawListingsReport | null | undefined,
  range: { from: Date; to: Date },
  granularity: Granularity,
): ListingsReport {
  if (!raw) return EMPTY_LISTINGS_REPORT;

  // Zero-fill trục thời gian để đường/cột không đứt quãng
  const buckets = enumerateBuckets(range.from, range.to, granularity);
  const tsByKey = new Map<string, { listings: number; value: number }>();
  for (const row of raw.timeseries ?? []) {
    const key = bucketKeyOf(new Date(row.bucket), granularity);
    const prev = tsByKey.get(key);
    tsByKey.set(key, {
      listings: (prev?.listings ?? 0) + num(row.listings),
      value: (prev?.value ?? 0) + num(row.value),
    });
  }
  const timeSeries: ListingsTimeBucket[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    listings: tsByKey.get(b.key)?.listings ?? 0,
    value: tsByKey.get(b.key)?.value ?? 0,
  }));

  // Trạng thái tin — theo vòng đời, không theo số lượng
  const statusByKey = new Map(
    (raw.byStatus ?? []).map((s) => [s.status, { listings: num(s.listings), value: num(s.value) }]),
  );
  const byStatus: LabeledStat[] = STATUS_ORDER.filter((k) => statusByKey.has(k)).map((k) => ({
    key: k,
    label: STATUS_LABELS[k] ?? k,
    listings: statusByKey.get(k)!.listings,
    value: statusByKey.get(k)!.value,
  }));

  // Trạng thái phiên — cũng theo vòng đời
  const sessByKey = new Map(
    (raw.bySessionStatus ?? []).map((s) => [
      s.session_status,
      { listings: num(s.listings), value: num(s.value) },
    ]),
  );
  const bySessionStatus: LabeledStat[] = SESSION_STATUS_ORDER.filter((k) => sessByKey.has(k)).map(
    (k) => ({
      key: k,
      label: SESSION_STATUS_LABELS[k as AuctionSessionStatus],
      listings: sessByKey.get(k)!.listings,
      value: sessByKey.get(k)!.value,
    }),
  );

  const byCategory: LabeledStat[] = (raw.byCategory ?? [])
    .map((c) => ({
      key: c.parent_slug,
      label: PARENT_LABELS[c.parent_slug] ?? c.parent_slug,
      listings: num(c.listings),
      value: num(c.value),
    }))
    .sort((a, b) => b.listings - a.listings);

  const byCategoryChild: CategoryChildStat[] = (raw.byCategoryChild ?? [])
    .map((c) => ({
      slug: c.slug,
      name: c.name || c.slug,
      parentSlug: c.parent_slug,
      parentLabel: PARENT_LABELS[c.parent_slug] ?? c.parent_slug,
      listings: num(c.listings),
      value: num(c.value),
    }))
    .sort((a, b) => b.listings - a.listings);

  // "Không rõ" luôn xuống cuối
  const byProvince: ProvinceListingStat[] = (raw.byProvince ?? [])
    .map((p) => ({
      province: p.province,
      listings: num(p.listings),
      value: num(p.value),
    }))
    .sort((a, b) => {
      if (a.province === "Không rõ") return 1;
      if (b.province === "Không rõ") return -1;
      return b.listings - a.listings;
    });

  // Histogram luôn đủ cột: chèn bucket thiếu với 0. "Chưa quy đổi" chỉ hiện khi có tin.
  const priceByKey = new Map(
    (raw.byPriceBucket ?? []).map((b) => [
      b.bucket,
      { listings: num(b.listings), value: num(b.value) },
    ]),
  );
  const byPriceBucket: LabeledStat[] = PRICE_BUCKET_ORDER.filter(
    (k) => k !== "unknown" || priceByKey.has(k),
  ).map((k) => ({
    key: k,
    label: PRICE_BUCKET_LABELS[k] ?? k,
    listings: priceByKey.get(k)?.listings ?? 0,
    value: priceByKey.get(k)?.value ?? 0,
  }));

  const mapEntities = (rows: RawListingsReport["topOrgs"]): TopEntityStat[] =>
    (rows ?? []).map((o) => ({
      id: o.id,
      name: o.name || "—",
      sub: o.sub ?? null,
      listings: num(o.listings),
      value: num(o.value),
    }));

  const covTotal = num(raw.coverage?.total);
  const coverage: CoverageStat[] = COVERAGE_LABELS.map(({ key, label }) => {
    const count = num(raw.coverage?.[key]);
    return {
      key: key as string,
      label,
      count,
      total: covTotal,
      pct: covTotal > 0 ? (count / covTotal) * 100 : 0,
    };
  });

  const p = raw.kpis?.period;
  const t = raw.kpis?.total;

  return {
    kpis: {
      periodListings: num(p?.listings),
      periodValue: num(p?.value),
      medianValue: num(p?.medianValue),
      valuedCount: num(p?.valuedCount),
      orgs: num(p?.orgs),
      owners: num(p?.owners),
      provinces: num(p?.provinces),
      views: num(p?.views),
      totalListings: num(t?.listings),
      totalActive: num(t?.active),
      totalPending: num(t?.pending),
      totalDraft: num(t?.draft),
      totalValue: num(t?.value),
    },
    timeSeries,
    byStatus,
    bySessionStatus,
    byCategory,
    byCategoryChild,
    byProvince,
    byPriceBucket,
    topOrgs: mapEntities(raw.topOrgs),
    topOwners: mapEntities(raw.topOwners),
    coverage,
  };
}

// "Sắp đấu giá theo kế hoạch" — dữ liệu CÔNG KHAI của kế hoạch đấu giá.
//
// Đây là mặt công khai duy nhất của module kế hoạch (Phase 10 của
// docs/owner-auction-planning-plan.md). Nguồn là RPC `get_public_plan_items`
// (SECURITY DEFINER, cấp cho `anon`): chỉ kế hoạch ĐÃ DUYỆT và ĐÃ BẬT công khai,
// và chỉ các trường dưới đây.
//
// ⚠️ KHÔNG mở rộng kiểu này bằng cách "thêm một trường cho tiện". Mỗi trường mới
// là một lần mở dữ liệu nhà nước ra Internet: phải mở ở RPC trước, và đó chính
// là chỗ để dừng lại tự hỏi có nên mở không. Những thứ CỐ Ý không có ở đây:
// id nội bộ (kế hoạch, tài sản, Trạm, chi nhánh, hồ sơ, tin đăng, người phụ
// trách), tháng dự kiến (chỉ công khai QUÝ) và giá khởi điểm (chỉ khi đơn vị bật
// công tắc riêng).
//
// File THUẦN (không import React/Supabase) để test bằng vitest.

/** Một tài sản dự kiến đấu giá, như trang công khai nhìn thấy. */
export interface PublicPlanItem {
  /** Mã công khai 32 hex — tay nắm DUY NHẤT của tài sản ở phía công khai. */
  code: string;
  /** Mã ĐVHC cấp xã (mã chính thức, `admin_units` vốn đã công khai). */
  communeCode: string;
  communeName: string;
  title: string;
  lotLabels: string | null;
  areaM2: number | null;
  landUseCode: string | null;
  /** "2026-Q4" — quý dự kiến theo bản mốc đã duyệt. Null = chưa xác định. */
  plannedQuarter: string | null;
  /** Chỉ có khi đơn vị bật công tắc giá; mặc định null. */
  unitStartPrice: number | null;
  expectedStartValue: number | null;
  followCount: number;
  followed: boolean;
}

export interface PublicPlanUnit {
  code: string;
  name: string;
  itemCount: number;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

/** RPC trả SETOF JSONB (khoá bị bỏ hẳn khi giá bị ẩn) ⇒ đọc phòng thủ từng khoá. */
export function parsePublicPlanItem(row: unknown): PublicPlanItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const code = str(r.code);
  const communeCode = str(r.commune_code);
  if (!code || !communeCode) return null;
  return {
    code,
    communeCode,
    communeName: str(r.commune_name) ?? "",
    title: str(r.title) ?? "Tài sản chưa đặt tên",
    lotLabels: str(r.lot_labels),
    areaM2: num(r.area_m2),
    landUseCode: str(r.land_use_code),
    plannedQuarter: str(r.planned_quarter),
    unitStartPrice: num(r.unit_start_price),
    expectedStartValue: num(r.expected_start_value),
    followCount: num(r.follow_count) ?? 0,
    followed: r.followed === true,
  };
}

export function parsePublicPlanUnit(row: unknown): PublicPlanUnit | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const code = str(r.code);
  if (!code) return null;
  return { code, name: str(r.name) ?? code, itemCount: num(r.item_count) ?? 0 };
}

const ROMAN: Record<string, string> = { "1": "I", "2": "II", "3": "III", "4": "IV" };

/**
 * "2026-Q4" → "Quý IV/2026". Nhãn riêng của trang công khai (không dùng
 * `src/lib/auctionPlan/totals.ts`): phía công khai nhận chuỗi quý từ server chứ
 * không nhận ngày, và trang công khai không được kéo theo thư viện cổng nội bộ.
 */
export function quarterLabel(quarter: string | null | undefined): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarter ?? "");
  if (!m) return "Chưa xác định thời gian";
  return `Quý ${ROMAN[m[2]]}/${m[1]}`;
}

export interface PublicPlanGroup {
  quarter: string | null;
  label: string;
  items: PublicPlanItem[];
}

/**
 * Gom theo quý, giữ đúng thứ tự quý tăng dần của server; quý trống (null) xuống
 * cuối. Không tự sắp lại trong nhóm — server đã sắp theo xã rồi mã tài sản.
 */
export function groupByQuarter(items: PublicPlanItem[]): PublicPlanGroup[] {
  const order: (string | null)[] = [];
  const bucket = new Map<string, PublicPlanItem[]>();
  for (const item of items) {
    const key = item.plannedQuarter ?? "";
    if (!bucket.has(key)) {
      bucket.set(key, []);
      order.push(item.plannedQuarter);
    }
    bucket.get(key)!.push(item);
  }
  const groups = order.map((quarter) => ({
    quarter,
    label: quarterLabel(quarter),
    items: bucket.get(quarter ?? "")!,
  }));
  // Quý đã biết trước, "chưa xác định" sau — ổn định, không đổi thứ tự còn lại.
  return [...groups.filter((g) => g.quarter), ...groups.filter((g) => !g.quarter)];
}

/** "960 m²" — diện tích nhóm nghìn bằng dấu phẩy, bỏ ".0" (cùng quy ước tiền). */
export function areaLabel(areaM2: number | null): string | null {
  if (areaM2 === null) return null;
  const rounded = Math.round(areaM2 * 10) / 10;
  return `${rounded.toLocaleString("en-US", { maximumFractionDigits: 1 })} m²`;
}

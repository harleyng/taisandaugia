import { z } from "zod";
import type { PlanItemFormValues } from "@/hooks/useAuctionPlan";
import { suggestExpectedValue } from "@/lib/auctionPlan/totals";
import type { AuctionPlanItem } from "@/lib/auctionPlan/types";

/** Ô "Chưa xác định" của Select — Radix không nhận value rỗng. */
export const NONE = "none";

const nullableNumber = z.number().nonnegative("Không được âm").nullable();

/**
 * Trường MỐC của một tài sản trong kế hoạch (A4.3). Chỉ có các trường client
 * được GRANT; `item_code` / `seq` do DB sinh, `workspace_id` / `branch_id` /
 * `admin_unit_code` do trigger ép.
 */
export const planItemSchema = z.object({
  asset_type: z.enum(["land_use_right", "public_asset", "other"]),
  title: z.string().trim().min(3, "Tên lô đất cần ít nhất 3 ký tự").max(300, "Tối đa 300 ký tự"),
  lot_labels: z.string().trim().max(200, "Tối đa 200 ký tự"),
  lot_count: z.number().int("Phải là số nguyên").positive("Phải lớn hơn 0").nullable(),
  map_sheet: z.string().trim().max(50, "Tối đa 50 ký tự"),
  parcel_no: z.string().trim().max(50, "Tối đa 50 ký tự"),
  location: z.string().trim().max(1000, "Tối đa 1000 ký tự"),
  area_m2: nullableNumber,
  land_use_code: z.string().trim().max(50, "Tối đa 50 ký tự"),
  allocation_form: z.enum(["giao_co_thu_tien", "thue_tra_mot_lan", "thue_tra_hang_nam", "khac", NONE]),
  unit_start_price: nullableNumber,
  expected_start_value: nullableNumber,
  /** NONE = chưa chọn tháng; trình kế hoạch sẽ bị chặn tới khi chọn. */
  planned_month: z.string(),
  planned_method: z.enum([
    "truc_tiep_loi_noi",
    "bo_phieu_gian_tiep",
    "bo_phieu_truc_tiep",
    "truc_tuyen",
    "chua_xac_dinh",
  ]),
  executing_unit: z.string().trim().max(200, "Tối đa 200 ký tự"),
});

export type PlanItemFormInput = z.infer<typeof planItemSchema>;

export const DEFAULT_EXECUTING_UNIT = "Phòng Kinh tế";

export function planItemDefaults(item: AuctionPlanItem | null): PlanItemFormInput {
  return {
    asset_type: item?.asset_type ?? "land_use_right",
    title: item?.title ?? "",
    lot_labels: item?.lot_labels ?? "",
    lot_count: item?.lot_count ?? null,
    map_sheet: item?.map_sheet ?? "",
    parcel_no: item?.parcel_no ?? "",
    location: item?.location ?? "",
    area_m2: item?.area_m2 === null || item?.area_m2 === undefined ? null : Number(item.area_m2),
    land_use_code: item?.land_use_code ?? "",
    allocation_form: item?.allocation_form ?? NONE,
    unit_start_price:
      item?.unit_start_price === null || item?.unit_start_price === undefined ? null : Number(item.unit_start_price),
    expected_start_value:
      item?.expected_start_value === null || item?.expected_start_value === undefined
        ? null
        : Number(item.expected_start_value),
    planned_month: item?.planned_month ?? NONE,
    planned_method: item?.planned_method ?? "chua_xac_dinh",
    executing_unit: item?.executing_unit ?? DEFAULT_EXECUTING_UNIT,
  };
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

export function toPlanItemValues(input: PlanItemFormInput): PlanItemFormValues {
  const area = input.area_m2;
  const price = input.unit_start_price;
  return {
    asset_type: input.asset_type,
    title: input.title.trim(),
    lot_labels: orNull(input.lot_labels),
    lot_count: input.lot_count,
    map_sheet: orNull(input.map_sheet),
    parcel_no: orNull(input.parcel_no),
    location: orNull(input.location),
    area_m2: area,
    land_use_code: orNull(input.land_use_code),
    allocation_form: input.allocation_form === NONE ? null : input.allocation_form,
    unit_start_price: price,
    expected_start_value: input.expected_start_value ?? suggestExpectedValue(area, price),
    planned_month: input.planned_month === NONE ? null : input.planned_month,
    planned_method: input.planned_method,
    executing_unit: orNull(input.executing_unit),
  };
}

/** 12 tháng của năm kế hoạch — `planned_month` phải là ngày 01 và trong năm đó. */
export function monthOptions(planYear: number): { value: string; label: string }[] {
  return Array.from({ length: 12 }, (_, i) => ({
    value: `${planYear}-${String(i + 1).padStart(2, "0")}-01`,
    label: `Tháng ${i + 1}/${planYear}`,
  }));
}

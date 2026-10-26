import { Controller, type UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoneyFull } from "@/utils/money";
import {
  AUCTION_PLAN_ALLOCATION_FORM_LABELS,
  AUCTION_PLAN_ASSET_TYPE_LABELS,
  AUCTION_PLAN_METHOD_LABELS,
  type AuctionPlanAllocationForm,
  type AuctionPlanAssetType,
  type AuctionPlanMethod,
} from "@/lib/auctionPlan/types";
import { suggestExpectedValue } from "@/lib/auctionPlan/totals";
import { PlanNumberInput } from "./PlanNumberInput";
import { NONE, monthOptions, type PlanItemFormInput } from "./planItemSchema";

const Star = () => <span className="text-destructive">*</span>;

const Err = ({ message }: { message?: string }) =>
  message ? <p className="text-xs text-destructive">{message}</p> : null;

interface PlanItemFieldsProps {
  form: UseFormReturn<PlanItemFormInput>;
  planYear: number;
  /** Kế hoạch đã trình / đã duyệt ⇒ trường mốc khoá, hộp thoại chỉ để xem. */
  disabled: boolean;
}

/** Các trường MỐC của một tài sản (A4.3) — hai cột trên desktop, một cột trên mobile. */
export function PlanItemFields({ form, planYear, disabled }: PlanItemFieldsProps) {
  const { errors } = form.formState;
  const area = form.watch("area_m2");
  const price = form.watch("unit_start_price");
  const expected = form.watch("expected_start_value");
  const suggestion = suggestExpectedValue(area, price);
  const months = monthOptions(planYear);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pi-asset-type">
            Loại tài sản <Star />
          </Label>
          <Controller
            control={form.control}
            name="asset_type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => v && field.onChange(v as AuctionPlanAssetType)} disabled={disabled}>
                <SelectTrigger id="pi-asset-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(AUCTION_PLAN_ASSET_TYPE_LABELS) as AuctionPlanAssetType[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {AUCTION_PLAN_ASSET_TYPE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">Quyết định danh sách mốc công việc của tài sản.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pi-method">
            Hình thức đấu giá <Star />
          </Label>
          <Controller
            control={form.control}
            name="planned_method"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => v && field.onChange(v as AuctionPlanMethod)} disabled={disabled}>
                <SelectTrigger id="pi-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(AUCTION_PLAN_METHOD_LABELS) as AuctionPlanMethod[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {AUCTION_PLAN_METHOD_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pi-title">
          Tên lô đất / tài sản <Star />
        </Label>
        <Input id="pi-title" disabled={disabled} placeholder="VD: Lô LK1-10, khu dân cư Đồng Chùa" {...form.register("title")} />
        <Err message={errors.title?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="pi-lot-labels">Số lô</Label>
          <Input id="pi-lot-labels" disabled={disabled} placeholder="LK1-10; LK2-13→16" {...form.register("lot_labels")} />
          <Err message={errors.lot_labels?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pi-lot-count">Số lô (đếm)</Label>
          <Controller
            control={form.control}
            name="lot_count"
            render={({ field }) => (
              <PlanNumberInput id="pi-lot-count" value={field.value} onChange={field.onChange} disabled={disabled} />
            )}
          />
          <Err message={errors.lot_count?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pi-area">Diện tích (m²)</Label>
          <Controller
            control={form.control}
            name="area_m2"
            render={({ field }) => (
              <PlanNumberInput id="pi-area" value={field.value} onChange={field.onChange} disabled={disabled} decimals />
            )}
          />
          <Err message={errors.area_m2?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="pi-map-sheet">Tờ bản đồ</Label>
          <Input id="pi-map-sheet" disabled={disabled} {...form.register("map_sheet")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pi-parcel">Thửa</Label>
          <Input id="pi-parcel" disabled={disabled} {...form.register("parcel_no")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pi-land-use">Loại đất</Label>
          <Input id="pi-land-use" disabled={disabled} placeholder="ONT, ODT, TMD…" {...form.register("land_use_code")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pi-location">Đặc điểm, vị trí</Label>
        <Textarea
          id="pi-location"
          rows={2}
          disabled={disabled}
          placeholder="Giáp đường bê tông 5 m, đã có hạ tầng điện nước…"
          {...form.register("location")}
        />
        <Err message={errors.location?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pi-unit-price">Giá khởi điểm dự kiến (đồng/m²)</Label>
          <Controller
            control={form.control}
            name="unit_start_price"
            render={({ field }) => (
              <PlanNumberInput id="pi-unit-price" value={field.value} onChange={field.onChange} disabled={disabled} />
            )}
          />
          <Err message={errors.unit_start_price?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pi-expected">Giá trị khởi điểm dự kiến (đồng)</Label>
          <Controller
            control={form.control}
            name="expected_start_value"
            render={({ field }) => (
              <PlanNumberInput id="pi-expected" value={field.value} onChange={field.onChange} disabled={disabled} />
            )}
          />
          {suggestion !== null && suggestion !== expected && !disabled ? (
            <p className="text-xs text-muted-foreground">
              Diện tích × đơn giá = {formatMoneyFull(suggestion)}.{" "}
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={() => form.setValue("expected_start_value", suggestion, { shouldDirty: true })}
              >
                Dùng số này
              </button>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Tự tính bằng diện tích × đơn giá; sửa được.</p>
          )}
          <Err message={errors.expected_start_value?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pi-month">Thời gian dự kiến</Label>
          <Controller
            control={form.control}
            name="planned_month"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => v && field.onChange(v)} disabled={disabled}>
                <SelectTrigger id="pi-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Chưa xác định</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">Chưa chọn tháng thì không trình kế hoạch được.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pi-allocation">Hình thức giao đất</Label>
          <Controller
            control={form.control}
            name="allocation_form"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => v && field.onChange(v as AuctionPlanAllocationForm)} disabled={disabled}>
                <SelectTrigger id="pi-allocation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Chưa xác định</SelectItem>
                  {(Object.keys(AUCTION_PLAN_ALLOCATION_FORM_LABELS) as AuctionPlanAllocationForm[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {AUCTION_PLAN_ALLOCATION_FORM_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pi-executing">Đơn vị thực hiện</Label>
        <Input id="pi-executing" disabled={disabled} {...form.register("executing_unit")} />
        <Err message={errors.executing_unit?.message} />
      </div>
    </div>
  );
}

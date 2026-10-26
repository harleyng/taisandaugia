import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSavePlanItem } from "@/hooks/useAuctionPlan";
import { suggestExpectedValue } from "@/lib/auctionPlan/totals";
import type { AuctionPlan, AuctionPlanItem } from "@/lib/auctionPlan/types";
import { PlanItemFields } from "./PlanItemFields";
import { planItemDefaults, planItemSchema, toPlanItemValues, type PlanItemFormInput } from "./planItemSchema";

interface PlanItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AuctionPlan;
  /** null = thêm mới. */
  item: AuctionPlanItem | null;
  /** false ⇒ chỉ xem (kế hoạch đã trình / đã duyệt: trigger của DB khoá trường mốc). */
  canEdit: boolean;
}

/**
 * Thêm / sửa một tài sản trong kế hoạch. Chỉ chứa trường MỐC — trường thực hiện
 * (dự kiến mới, người phụ trách, liên kết hồ sơ) là của Phase 5, nằm ở side
 * sheet của tab "Tiến độ".
 */
export function PlanItemDialog({ open, onOpenChange, plan, item, canEdit }: PlanItemDialogProps) {
  const saveM = useSavePlanItem(plan);
  const form = useForm<PlanItemFormInput>({
    resolver: zodResolver(planItemSchema),
    defaultValues: planItemDefaults(null),
  });

  useEffect(() => {
    if (open) form.reset(planItemDefaults(item));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  // Gợi ý giá trị khởi điểm = diện tích × đơn giá, chỉ khi người dùng chưa điền.
  const area = form.watch("area_m2");
  const price = form.watch("unit_start_price");
  useEffect(() => {
    if (!canEdit) return;
    const suggestion = suggestExpectedValue(area, price);
    if (suggestion !== null && form.getValues("expected_start_value") === null) {
      form.setValue("expected_start_value", suggestion, { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, price, canEdit]);

  const onSubmit = form.handleSubmit((values) => {
    saveM.mutate(
      { itemId: item?.id ?? null, values: toPlanItemValues(values) },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !saveM.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {!canEdit ? `Tài sản ${item?.item_code ?? ""}` : item ? `Sửa tài sản ${item.item_code}` : "Thêm tài sản vào kế hoạch"}
            </DialogTitle>
            <DialogDescription>
              {canEdit
                ? "Mã tài sản do hệ thống cấp theo thứ tự trong kế hoạch."
                : "Kế hoạch đã trình hoặc đã duyệt nên danh mục đang khoá. Mở điều chỉnh kế hoạch để sửa."}
            </DialogDescription>
          </DialogHeader>

          <PlanItemFields form={form} planYear={plan.plan_year} disabled={!canEdit} />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={saveM.isPending} onClick={() => onOpenChange(false)}>
              {canEdit ? "Huỷ" : "Đóng"}
            </Button>
            {canEdit && (
              <Button type="submit" disabled={saveM.isPending}>
                {saveM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {item ? "Lưu" : "Thêm tài sản"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

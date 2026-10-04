import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUpsertOwnerSubPlan } from "@/hooks/useAdminOwnerSubscriptions";
import { useOwnerSubBenefitCatalog } from "@/hooks/useOwnerSubscriptionPlans";
import { benefitLineValid } from "@/lib/ownerSubscription/benefits";
import { PLAN_TIER_LABELS } from "@/lib/ownerSubscription/catalog";
import { OVERAGE_HINTS, OVERAGE_LABELS } from "@/lib/ownerSubscription/status";
import type { BenefitLineInput, OverageMode, OwnerSubPlan, PlanTier } from "@/lib/ownerSubscription/types";
import { BenefitLinesEditor } from "./BenefitLinesEditor";
import { VndInput } from "./VndInput";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = thêm gói mới. */
  plan: OwnerSubPlan | null;
  nextSortOrder: number;
}

const Req = () => <span className="text-destructive">*</span>;

/** Thêm / sửa một gói trong danh mục gói dịch vụ. */
export function PlanFormDialog({ open, onOpenChange, plan, nextSortOrder }: Props) {
  const save = useUpsertOwnerSubPlan();
  const { data: catalog = [], isLoading: catalogLoading } = useOwnerSubBenefitCatalog();
  const [name, setName] = useState("");
  const [fitLine, setFitLine] = useState("");
  const [highlightLine, setHighlightLine] = useState("");
  const [tier, setTier] = useState<PlanTier>("standard");
  const [price, setPrice] = useState(0);
  const [overage, setOverage] = useState<OverageMode>("credits");
  const [featured, setFeatured] = useState(false);
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(nextSortOrder);
  const [benefits, setBenefits] = useState<BenefitLineInput[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(plan?.name ?? "");
    setFitLine(plan?.fit_line ?? "");
    setHighlightLine(plan?.highlight_line ?? "");
    setTier(plan?.tier ?? "standard");
    setPrice(plan?.monthly_price_vnd ?? 0);
    setOverage(plan?.overage_mode ?? "credits");
    setFeatured(plan?.is_featured ?? false);
    setActive(plan?.is_active ?? true);
    setSortOrder(plan?.sort_order ?? nextSortOrder);
    setBenefits(
      plan?.benefits.map((l) => ({ benefit_key: l.benefit_key, quota: l.quota, cycle: l.cycle })) ??
        [{ benefit_key: "scan_3d_owner", quota: 10, cycle: "month" }],
    );
  }, [open, plan, nextSortOrder]);

  const nameOk = name.trim().length >= 2 && name.trim().length <= 60;
  const defs = new Map(catalog.map((d) => [d.key, d]));
  const benefitsOk = benefits.every((l) => benefitLineValid(l, defs.get(l.benefit_key)));
  const valid = nameOk && price > 0 && benefits.length > 0 && benefitsOk;

  const onSave = () =>
    save.mutate(
      {
        planId: plan?.id ?? null,
        name: name.trim(),
        fitLine,
        highlightLine,
        tier,
        monthlyPriceVnd: price,
        overageMode: overage,
        isFeatured: featured,
        isActive: active,
        sortOrder,
        benefits: benefits.map((l) => ({
          benefit_key: l.benefit_key,
          quota: l.quota,
          cycle: defs.get(l.benefit_key)?.kind === "quota" ? l.cycle : null,
        })),
      },
      { onSuccess: () => onOpenChange(false) },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Sửa gói ${plan.name}` : "Thêm gói vào danh mục"}</DialogTitle>
          <DialogDescription>
            Sửa danh mục không đổi gói Trạm đã mua — áp dụng từ lần mua / gia hạn sau.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Tên gói <Req /></Label>
              <Input id="plan-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              {!nameOk && <p className="text-xs text-destructive">Tên gói từ 2 đến 60 ký tự.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Giá mỗi tháng (chưa VAT) <Req /></Label>
              <VndInput id="plan-price" value={price} onChange={setPrice} />
              {price <= 0 && <p className="text-xs text-destructive">Nhập giá lớn hơn 0.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-fit">Phù hợp với</Label>
              <Input id="plan-fit" value={fitLine} maxLength={120} placeholder="Đấu giá đều đặn hằng tháng" onChange={(e) => setFitLine(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-hl">Câu nổi bật trên thẻ</Label>
              <Input id="plan-hl" value={highlightLine} maxLength={120} placeholder="Đủ dùng cho cả Trạm mỗi tháng" onChange={(e) => setHighlightLine(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Kiểu hiển thị <Req /></Label>
              <Select value={tier} onValueChange={(v) => setTier(v as PlanTier)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLAN_TIER_LABELS) as PlanTier[]).map((t) => (
                    <SelectItem key={t} value={t}>{PLAN_TIER_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-sort">Thứ tự (thấp → cao) <Req /></Label>
              <Input id="plan-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(Math.floor(Number(e.target.value)) || 0)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Đang bán
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={featured} onCheckedChange={setFeatured} /> Nhãn "Phổ biến nhất" (chỉ một gói)
            </label>
          </div>

          <div className="space-y-2">
            <Label>Quyền lợi trong gói <Req /></Label>
            <p className="text-xs text-muted-foreground">
              Chọn từ danh mục quyền lợi, đặt hạn mức và chu kỳ làm mới cho từng dòng (theo lịch, giờ Việt Nam).
            </p>
            {catalogLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải danh mục quyền lợi…
              </div>
            ) : (
              <BenefitLinesEditor value={benefits} onChange={setBenefits} catalog={catalog} />
            )}
            {benefits.length === 0 && <p className="text-xs text-destructive">Thêm ít nhất một quyền lợi.</p>}
            {!benefitsOk && (
              <p className="text-xs text-destructive">
                Nhập hạn mức là số nguyên lớn hơn 0 (hoặc chọn Không giới hạn) và chọn chu kỳ cho mọi dòng.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Khi hết hạn mức (quyền lợi hệ thống kiểm) <Req /></Label>
            <RadioGroup value={overage} onValueChange={(v) => setOverage(v as OverageMode)} className="gap-3">
              {(["credits", "block"] as const).map((m) => (
                <label key={m} className="flex items-start gap-2.5 rounded-xl border p-3">
                  <RadioGroupItem value={m} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{OVERAGE_LABELS[m]}</span>
                    <span className="block text-xs text-muted-foreground">{OVERAGE_HINTS[m]}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button disabled={!valid || save.isPending} onClick={onSave}>
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {plan ? "Lưu gói" : "Thêm gói"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

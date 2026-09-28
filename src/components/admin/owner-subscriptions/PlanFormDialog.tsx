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
import { PLAN_TIER_LABELS } from "@/lib/ownerSubscription/catalog";
import { OVERAGE_HINTS, OVERAGE_LABELS } from "@/lib/ownerSubscription/status";
import type { EntitlementInput, OverageMode, OwnerSubPlan, PlanBenefit, PlanTier } from "@/lib/ownerSubscription/types";
import { BenefitLinesEditor } from "./BenefitLinesEditor";
import { EntitlementLinesEditor } from "./EntitlementLinesEditor";
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
  const [name, setName] = useState("");
  const [fitLine, setFitLine] = useState("");
  const [highlightLine, setHighlightLine] = useState("");
  const [tier, setTier] = useState<PlanTier>("standard");
  const [price, setPrice] = useState(0);
  const [overage, setOverage] = useState<OverageMode>("credits");
  const [featured, setFeatured] = useState(false);
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(nextSortOrder);
  const [lines, setLines] = useState<EntitlementInput[]>([]);
  const [benefits, setBenefits] = useState<PlanBenefit[]>([]);

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
    setLines(plan?.entitlements ?? [{ variant_key: "scan_3d_owner", monthly_quota: 10 }]);
    setBenefits(plan?.benefits ?? []);
  }, [open, plan, nextSortOrder]);

  const nameOk = name.trim().length >= 2 && name.trim().length <= 60;
  const benefitsOk = benefits.every((b) => b.group.trim() && b.label.trim() && b.value.trim());
  const valid = nameOk && price > 0 && lines.length > 0 && benefitsOk;

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
        entitlements: lines,
        benefits: benefits.map((b) => ({ group: b.group.trim(), label: b.label.trim(), value: b.value.trim() })),
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
            <Label>Tính năng tính hạn mức <Req /></Label>
            <p className="text-xs text-muted-foreground">Hệ thống kiểm hạn mức này mỗi tháng (làm mới ngày 01, giờ Việt Nam).</p>
            <EntitlementLinesEditor value={lines} onChange={setLines} />
            {lines.length === 0 && <p className="text-xs text-destructive">Chọn ít nhất một tính năng.</p>}
          </div>

          <div className="space-y-2">
            <Label>Quyền lợi hiển thị</Label>
            <BenefitLinesEditor value={benefits} onChange={setBenefits} />
            {!benefitsOk && <p className="text-xs text-destructive">Điền đủ nhóm, quyền lợi và giá trị cho mỗi dòng.</p>}
          </div>

          <div className="space-y-2">
            <Label>Khi hết hạn mức tháng <Req /></Label>
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

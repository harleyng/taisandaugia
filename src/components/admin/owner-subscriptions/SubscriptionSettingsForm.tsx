import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useUpsertOwnerSubscription } from "@/hooks/useAdminOwnerSubscriptions";
import type { AdminSubDetail } from "@/hooks/useAdminOwnerSubscriptions";
import { OVERAGE_HINTS, OVERAGE_LABELS, TERM_PRESETS } from "@/lib/ownerSubscription/status";
import type { EntitlementInput, OverageMode } from "@/lib/ownerSubscription/types";
import { EntitlementLinesEditor } from "./EntitlementLinesEditor";
import { VndInput } from "./VndInput";

interface Props {
  workspaceId: string;
  detail: AdminSubDetail;
  canEdit: boolean;
}

const DEFAULT_ENTITLEMENTS: EntitlementInput[] = [
  { variant_key: "scan_3d_owner", monthly_quota: 10 },
  { variant_key: "report_portfolio_owner", monthly_quota: null },
];

const Req = () => <span className="text-destructive">*</span>;

/** Cấu hình gói của một Trạm: tên, giá mỗi kỳ, số tháng, tính năng + hạn mức, xử lý khi hết hạn mức. */
export function SubscriptionSettingsForm({ workspaceId, detail, canEdit }: Props) {
  const save = useUpsertOwnerSubscription();
  const sub = detail.sub;

  const [planName, setPlanName] = useState("Gói Doanh nghiệp");
  const [price, setPrice] = useState(0);
  const [months, setMonths] = useState(12);
  const [overage, setOverage] = useState<OverageMode>("block");
  const [lines, setLines] = useState<EntitlementInput[]>(DEFAULT_ENTITLEMENTS);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!sub) return;
    setPlanName(sub.plan_name);
    setPrice(Number(sub.price_vnd));
    setMonths(sub.term_months);
    setOverage(sub.overage_mode);
    setLines(detail.entitlements);
    setNote(sub.note ?? "");
  }, [sub, detail.entitlements]);

  const nameOk = planName.trim().length >= 2;
  const monthsOk = Number.isInteger(months) && months >= 1 && months <= 36;
  const valid = nameOk && monthsOk && lines.length > 0;

  const onSave = () =>
    save.mutate({ workspaceId, planName: planName.trim(), priceVnd: price, termMonths: months, overageMode: overage, entitlements: lines, note });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sub-name">Tên gói <Req /></Label>
          <Input id="sub-name" value={planName} disabled={!canEdit} onChange={(e) => setPlanName(e.target.value)} />
          {!nameOk && <p className="text-xs text-destructive">Tên gói ít nhất 2 ký tự.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-price">Giá mỗi kỳ <Req /></Label>
          <VndInput id="sub-price" value={price} onChange={setPrice} disabled={!canEdit} />
          <p className="text-xs text-muted-foreground">0 ₫ = không thanh toán online, chỉ kích hoạt tay.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-months">Thời hạn mỗi kỳ <Req /></Label>
          <div className="flex flex-wrap items-center gap-2">
            {TERM_PRESETS.map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={months === m ? "default" : "outline"}
                disabled={!canEdit}
                onClick={() => setMonths(m)}
              >
                {m} tháng
              </Button>
            ))}
            <div className="flex items-center gap-1.5">
              <Input
                id="sub-months"
                type="number"
                min={1}
                max={36}
                className="h-9 w-20"
                disabled={!canEdit}
                value={months}
                onChange={(e) => setMonths(Math.floor(Number(e.target.value)))}
              />
              <span className="text-xs text-muted-foreground">tháng</span>
            </div>
          </div>
          {!monthsOk && <p className="text-xs text-destructive">Thời hạn từ 1 đến 36 tháng.</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tính năng &amp; hạn mức mỗi tháng <Req /></Label>
        <p className="text-xs text-muted-foreground">
          Hạn mức làm mới ngày 01 hằng tháng (giờ Việt Nam), không cộng dồn. Tính năng không chọn vẫn tính credit như cũ.
        </p>
        <EntitlementLinesEditor value={lines} onChange={setLines} disabled={!canEdit} />
        {lines.length === 0 && <p className="text-xs text-destructive">Chọn ít nhất một tính năng.</p>}
      </div>

      <div className="space-y-2">
        <Label>Khi hết hạn mức tháng <Req /></Label>
        <RadioGroup value={overage} onValueChange={(v) => setOverage(v as OverageMode)} disabled={!canEdit} className="gap-3">
          {(["block", "credits"] as const).map((m) => (
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

      <div className="space-y-1.5">
        <Label htmlFor="sub-note">Ghi chú nội bộ</Label>
        <Textarea
          id="sub-note"
          rows={2}
          value={note}
          disabled={!canEdit}
          placeholder="Chỉ admin thấy — VD: số hợp đồng, người phụ trách"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {canEdit && (
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onSave} disabled={!valid || save.isPending}>
            {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            {sub ? "Lưu cấu hình" : "Tạo gói (nháp)"}
          </Button>
        </div>
      )}
      {sub && canEdit && (
        <p className="text-right text-xs text-muted-foreground">
          Thay đổi hạn mức có hiệu lực ngay, kể cả tháng đang chạy. Kỳ đã trả giữ bản chụp cấu hình lúc mua.
        </p>
      )}
    </div>
  );
}

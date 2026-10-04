import { useEffect, useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActivateOwnerSubPlan } from "@/hooks/useAdminOwnerSubscriptions";
import { planTermPrice } from "@/lib/ownerSubscription/catalog";
import {
  ACTIVATION_METHOD_LABELS,
  formatSubDate,
  termEnd,
  vnToday,
} from "@/lib/ownerSubscription/status";
import type { ActivationMethod, OwnerSubPlan, OwnerSubTermOption, SubStatus } from "@/lib/ownerSubscription/types";
import { formatMoneyFull } from "@/utils/money";
import { VndInput } from "./VndInput";

export interface ActivateCurrentSub {
  planId: string | null;
  planName: string;
  status: SubStatus | null;
  endsOn: string | null;
  termMonths: number;
  hasPending: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Gói đang bán đã mở cho Trạm này. */
  plans: OwnerSubPlan[];
  terms: OwnerSubTermOption[];
  current: ActivateCurrentSub | null;
}

const Req = () => <span className="text-destructive">*</span>;

const addDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Kích hoạt / gia hạn TAY theo một gói danh mục (chuyển khoản, hợp đồng, tặng). Hiệu lực
 * giống khi Trạm tự mua: cùng gói đang chạy ⇒ nối kỳ; khác gói ⇒ từ kỳ sau; chưa có /
 * hết hạn / đã huỷ ⇒ từ ngày chọn. Số tiền > 0 ⇒ sinh đơn doanh thu.
 */
export function ActivateSubscriptionDialog({ open, onOpenChange, workspaceId, plans, terms, current }: Props) {
  const activate = useActivateOwnerSubPlan();
  const today = vnToday();
  const running = !!current && (current.status === "active" || current.status === "scheduled");

  const [planId, setPlanId] = useState("");
  const [months, setMonths] = useState(12);
  const [startsOn, setStartsOn] = useState(today);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<ActivationMethod>("bank_transfer");
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");

  const plan = plans.find((p) => p.id === planId) ?? null;

  useEffect(() => {
    if (!open) return;
    const keep = current?.planId && plans.some((p) => p.id === current.planId) ? current.planId : (plans[0]?.id ?? "");
    setPlanId(keep);
    setMonths(current?.termMonths ?? 12);
    setStartsOn(vnToday());
    setMethod("bank_transfer");
    setPaidOn(vnToday());
    setNote("");
  }, [open, current, plans]);

  // Giá gợi ý theo danh mục; admin sửa được (giá hợp đồng).
  useEffect(() => {
    if (!plan || method === "complimentary") {
      if (method === "complimentary") setAmount(0);
      return;
    }
    const discount = terms.find((t) => t.months === months)?.discount_pct ?? 0;
    setAmount(planTermPrice(plan.monthly_price_vnd, months, discount));
  }, [plan, months, method, terms]);

  const effect = !running ? "now" : current?.planId === planId ? "extend" : "next_term";
  const start = running && current?.endsOn ? addDay(current.endsOn) : startsOn;
  const monthsOk = Number.isInteger(months) && months >= 1 && months <= 36;
  const blocked = running && effect === "next_term" && !!current?.hasPending;
  const valid = !!plan && monthsOk && !!start && !!paidOn && !blocked;

  const summary = useMemo(() => {
    if (!valid) return null;
    const range = `${formatSubDate(start)} – ${formatSubDate(termEnd(start, months))}`;
    const money = amount > 0 ? ` · ghi đơn ${formatMoneyFull(amount)}` : " · không sinh đơn hàng";
    if (effect === "extend") return `Nối kỳ gói ${plan!.name}: ${range}${money}`;
    if (effect === "next_term") return `Đổi sang ${plan!.name} từ kỳ sau (${range}) — hạn mức hiện tại giữ tới ${formatSubDate(current?.endsOn)}${money}`;
    return `Hiệu lực ${range}${money}`;
  }, [valid, start, months, amount, effect, plan, current?.endsOn]);

  const submit = () =>
    activate.mutate(
      {
        workspaceId,
        planId,
        months,
        startsOn: running ? null : startsOn,
        amountVnd: amount,
        method,
        paidOn,
        note,
      },
      { onSuccess: () => onOpenChange(false) },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kích hoạt / gia hạn gói</DialogTitle>
          <DialogDescription>
            Dùng khi tổ chức trả ngoài hệ thống (chuyển khoản, hợp đồng) hoặc được tặng. Chỉ chọn được gói đã mở cho tổ chức này. Số tiền &gt; 0 sẽ ghi một đơn hàng doanh thu.
          </DialogDescription>
        </DialogHeader>

        {plans.length === 0 ? (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Chưa có gói nào dành cho tổ chức này — vào Danh mục gói, bấm "Chọn tổ chức" ở gói cần mở.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Gói <Req /></Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder="Chọn gói" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {formatMoneyFull(p.monthly_price_vnd)}/tháng
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-months">Số tháng <Req /></Label>
              <Input id="act-months" type="number" min={1} max={36} value={months} onChange={(e) => setMonths(Math.floor(Number(e.target.value)))} />
              {!monthsOk && <p className="text-xs text-destructive">Từ 1 đến 36 tháng.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-start">Bắt đầu từ <Req /></Label>
              {running ? (
                <Input id="act-start" type="date" value={start} disabled />
              ) : (
                <Input id="act-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Hình thức <Req /></Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v as ActivationMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACTIVATION_METHOD_LABELS) as ActivationMethod[]).map((m) => (
                    <SelectItem key={m} value={m}>{ACTIVATION_METHOD_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-paid">Ngày thanh toán <Req /></Label>
              <Input id="act-paid" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="act-amount">Số tiền đã thu <Req /></Label>
              <VndInput id="act-amount" value={amount} onChange={setAmount} disabled={method === "complimentary"} />
              <p className="text-xs text-muted-foreground">Gợi ý theo giá danh mục và chiết khấu kỳ — sửa nếu theo hợp đồng.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="act-note">Ghi chú</Label>
              <Textarea id="act-note" rows={2} value={note} placeholder="VD: UNC số…, hợp đồng số…" onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        )}

        {blocked && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-foreground">
            Trạm đã có một lần đổi gói chờ áp dụng từ kỳ sau — chỉ nối kỳ được gói đang dùng ({current?.planName}).
          </p>
        )}
        {summary && <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{summary}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button onClick={submit} disabled={!valid || activate.isPending}>
            {activate.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Kích hoạt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

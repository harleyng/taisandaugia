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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActivateOwnerSubscription } from "@/hooks/useAdminOwnerSubscriptions";
import {
  ACTIVATION_METHOD_LABELS,
  formatSubDate,
  termEnd,
  vnToday,
} from "@/lib/ownerSubscription/status";
import type { ActivationMethod } from "@/lib/ownerSubscription/types";
import { formatMoneyFull } from "@/utils/money";
import { VndInput } from "./VndInput";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subId: string;
  defaultMonths: number;
  defaultAmount: number;
  /** ends_on hiện tại nếu gói đang chạy — kỳ mới nối tiếp từ ngày kế tiếp. */
  currentEndsOn: string | null;
}

const Req = () => <span className="text-destructive">*</span>;

function nextStart(currentEndsOn: string | null, today: string): string {
  if (currentEndsOn && currentEndsOn >= today) {
    const d = new Date(`${currentEndsOn}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  return today;
}

/** Kích hoạt / gia hạn TAY (chuyển khoản, hợp đồng, tặng). Số tiền > 0 ⇒ sinh đơn doanh thu. */
export function ActivateSubscriptionDialog({ open, onOpenChange, subId, defaultMonths, defaultAmount, currentEndsOn }: Props) {
  const activate = useActivateOwnerSubscription();
  const today = vnToday();
  const [months, setMonths] = useState(defaultMonths);
  const [startsOn, setStartsOn] = useState(nextStart(currentEndsOn, today));
  const [amount, setAmount] = useState(defaultAmount);
  const [method, setMethod] = useState<ActivationMethod>("bank_transfer");
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setMonths(defaultMonths);
    setStartsOn(nextStart(currentEndsOn, vnToday()));
    setAmount(defaultAmount);
    setMethod("bank_transfer");
    setPaidOn(vnToday());
    setNote("");
  }, [open, defaultMonths, defaultAmount, currentEndsOn]);

  useEffect(() => {
    if (method === "complimentary") setAmount(0);
  }, [method]);

  const monthsOk = Number.isInteger(months) && months >= 1 && months <= 36;
  const valid = monthsOk && !!startsOn && !!paidOn;

  const submit = () =>
    activate.mutate(
      { subId, months, startsOn, amountVnd: amount, method, paidOn, note },
      { onSuccess: () => onOpenChange(false) },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kích hoạt / gia hạn gói</DialogTitle>
          <DialogDescription>
            Dùng khi tổ chức trả ngoài hệ thống (chuyển khoản, hợp đồng) hoặc được tặng. Số tiền &gt; 0 sẽ ghi một đơn hàng doanh thu.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="act-months">Số tháng <Req /></Label>
            <Input id="act-months" type="number" min={1} max={36} value={months} onChange={(e) => setMonths(Math.floor(Number(e.target.value)))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-start">Bắt đầu từ <Req /></Label>
            <Input id="act-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
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
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="act-note">Ghi chú</Label>
            <Textarea id="act-note" rows={2} value={note} placeholder="VD: UNC số…, hợp đồng số…" onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        {valid && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Hiệu lực {formatSubDate(startsOn)} – {formatSubDate(termEnd(startsOn, months))}
            {amount > 0 ? ` · ghi đơn ${formatMoneyFull(amount)}` : " · không sinh đơn hàng"}
          </p>
        )}

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

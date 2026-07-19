import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { groupNumber, parseNumber, formatVnd } from "@/lib/advertising/slug";
import { useCustomers } from "@/hooks/useCustomers";
import { useWinOpportunity, opportunityErrorMessage } from "@/hooks/useOpportunities";
import type { Opportunity } from "@/types/opportunities";

interface Props {
  opportunity: Opportunity | null;
  onOpenChange: (open: boolean) => void;
  /** Huỷ ⇒ thẻ phải quay lại cột cũ (bảng đọc từ cache chưa đổi, chỉ cần đóng). */
  onDone?: () => void;
}

const AUTO = "__auto__";

/** Chuẩn hoá số để so trùng — giống hệt regexp bên RPC. */
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export function WinOpportunityDialog({ opportunity: o, onOpenChange, onDone }: Props) {
  const win = useWinOpportunity();
  const { data: customers } = useCustomers();

  const [amount, setAmount] = useState(0);
  const [gross, setGross] = useState(0);
  const [orderedAt, setOrderedAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customerId, setCustomerId] = useState<string>(AUTO);

  useEffect(() => {
    if (!o) return;
    setAmount(Number(o.amount ?? 0));
    setGross(Number(o.gross_amount ?? 0));
    setOrderedAt(format(new Date(), "yyyy-MM-dd"));
    setCustomerId(AUTO);
  }, [o]);

  const isCommission = o?.service_kind === "commission";
  const isCredit = o?.service_kind === "credit";
  const needsConvert = !!o?.lead_id;

  // Gợi ý khách trùng theo SĐT/email của lead — RPC cũng kiểm lại bên trong
  // transaction, đây chỉ là lớp giúp admin chọn đúng trước khi bấm.
  const duplicates = useMemo(() => {
    if (!needsConvert || !o?.lead) return [];
    const leadPhone = digits((o.lead as { phone?: string }).phone);
    if (!leadPhone) return [];
    return (customers ?? []).filter((c) => digits(c.phone) === leadPhone);
  }, [needsConvert, o, customers]);

  const submit = async () => {
    if (!o) return;
    try {
      const res = await win.mutateAsync({
        id: o.id,
        amount,
        gross: isCommission ? gross : amount,
        orderedAt: new Date(orderedAt).toISOString(),
        customerId: customerId === AUTO ? null : customerId,
      });
      toast.success(
        res.revenue_mode === "credit_ledger"
          ? "Đã chốt thắng — chờ khách nạp credit, chưa ghi nhận doanh thu"
          : "Đã chốt thắng và tạo đơn hàng",
      );
      onOpenChange(false);
      onDone?.();
    } catch (err) {
      toast.error(opportunityErrorMessage(err) ?? "Chốt cơ hội thất bại");
    }
  };

  return (
    <Dialog open={!!o} onOpenChange={(v) => { if (!v) { onOpenChange(false); onDone?.(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Chốt thắng cơ hội</DialogTitle>
        </DialogHeader>

        {o && (
          <div className="space-y-3 py-1">
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">{o.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {o.customer?.name ?? o.lead?.name} · {o.service?.name}
              </p>
            </div>

            {needsConvert && (
              <div className="space-y-1.5">
                <Label>Khách hàng</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO}>Tạo khách hàng mới từ lead</SelectItem>
                    {(customers ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.code ? ` · ${c.code}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {duplicates.length > 0 && customerId === AUTO && (
                  <p className="text-[11px] text-amber-700">
                    Đã có khách trùng SĐT: {duplicates.map((c) => c.name).join(", ")} — cân nhắc gộp vào thay vì tạo mới.
                  </p>
                )}
              </div>
            )}

            {isCredit ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-sm text-amber-800">Bán gói credit — không tạo đơn hàng ở bước này.</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Đơn hàng và doanh thu chỉ ghi nhận khi khách nạp credit thật.
                </p>
              </div>
            ) : (
              <>
                {isCommission && (
                  <div className="space-y-1.5">
                    <Label>Giá trị hợp đồng (VND)</Label>
                    <Input
                      inputMode="numeric"
                      value={groupNumber(gross)}
                      onChange={(e) => setGross(parseNumber(e.target.value))}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>{isCommission ? "Hoa hồng ghi nhận (VND)" : "Số tiền chốt (VND)"}</Label>
                  <Input
                    inputMode="numeric"
                    value={groupNumber(amount)}
                    onChange={(e) => setAmount(parseNumber(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Doanh thu ghi nhận: {formatVnd(amount)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Ngày ghi nhận</Label>
                  <Input type="date" value={orderedAt} onChange={(e) => setOrderedAt(e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onDone?.(); }}>Hủy</Button>
          <Button onClick={submit} disabled={win.isPending}>
            {win.isPending ? "Đang chốt…" : "Chốt thắng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

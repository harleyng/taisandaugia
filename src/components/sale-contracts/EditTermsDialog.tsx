import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InfoBox } from "@/components/shared/InfoBox";
import { formatVnd, groupNumber, parseNumber } from "@/lib/advertising/slug";
import { payableOf, splitEvenly, type MoneyInstallment } from "@/lib/saleContracts/money";
import {
  SALE_PAYEE_LABELS,
  type SaleContract,
  type SaleInstallment,
  type SalePayeeSide,
} from "@/types/auction-sale-contract";

interface Row {
  label: string;
  dueAt: string;
  amount: string;
}

const toDateInput = (iso: string | null | undefined): string =>
  iso && !Number.isNaN(new Date(iso).getTime()) ? new Date(iso).toISOString().slice(0, 10) : "";

export interface EditTermsValues {
  installments: MoneyInstallment[];
  payeeSide: SalePayeeSide;
  payeeBankInfo: string;
  contractNo: string;
  signDueAt: string | null;
  handoverDueAt: string | null;
  notarizationRequired: boolean;
  orgSigns: boolean;
}

/**
 * Điều khoản chỉ sửa được khi CHƯA ký và sổ tiền còn trống — cùng điều kiện mà
 * `sale_contract_set_terms` kiểm. Tổng các kỳ phải khớp số còn phải trả; kiểm
 * ngay tại chỗ để không phải đợi server trả `installments_mismatch`.
 */
export function EditTermsDialog({
  open, onOpenChange, contract, installments, isPending, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: SaleContract;
  installments: SaleInstallment[];
  isPending: boolean;
  onSubmit: (v: EditTermsValues) => void;
}) {
  const payable = payableOf(contract);
  const [rows, setRows] = useState<Row[]>([]);
  const [payeeSide, setPayeeSide] = useState<SalePayeeSide>(contract.payee_side);
  const [bank, setBank] = useState("");
  const [contractNo, setContractNo] = useState("");
  const [signDue, setSignDue] = useState("");
  const [handoverDue, setHandoverDue] = useState("");
  const [notarize, setNotarize] = useState(false);
  const [orgSigns, setOrgSigns] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(
      installments.length
        ? installments.map((i) => ({
            label: i.label ?? "",
            dueAt: toDateInput(i.due_at),
            amount: groupNumber(Number(i.amount)),
          }))
        : [{ label: "Thanh toán phần còn lại", dueAt: "", amount: groupNumber(payable) }],
    );
    setPayeeSide(contract.payee_side);
    setBank(contract.payee_bank_info ?? "");
    setContractNo(contract.contract_no ?? "");
    setSignDue(toDateInput(contract.sign_due_at));
    setHandoverDue(toDateInput(contract.handover_due_at));
    setNotarize(contract.notarization_required);
    setOrgSigns(contract.org_signs);
  }, [open, installments, contract, payable]);

  const sum = useMemo(() => rows.reduce((s, r) => s + parseNumber(r.amount), 0), [rows]);
  const diff = sum - payable;

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const splitInto = (n: number) => {
    const parts = splitEvenly(payable, n);
    setRows(parts.map((p, i) => ({ label: `Đợt ${i + 1}`, dueAt: rows[i]?.dueAt ?? "", amount: groupNumber(p) })));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Điều khoản hợp đồng</DialogTitle>
          <DialogDescription>
            Số còn phải thanh toán sau khi trừ tiền đặt trước: <strong>{formatVnd(payable)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Lịch thanh toán</Label>
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <Button key={n} type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => splitInto(n)}>
                    Chia {n} đợt
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_9rem_10rem_auto]">
                  <Input
                    aria-label={`Nội dung kỳ ${i + 1}`}
                    value={r.label}
                    placeholder={`Đợt ${i + 1}`}
                    disabled={isPending}
                    onChange={(e) => setRow(i, { label: e.target.value })}
                  />
                  <Input
                    aria-label={`Hạn kỳ ${i + 1}`}
                    type="date"
                    value={r.dueAt}
                    disabled={isPending}
                    onChange={(e) => setRow(i, { dueAt: e.target.value })}
                  />
                  <Input
                    aria-label={`Số tiền kỳ ${i + 1}`}
                    inputMode="numeric"
                    value={r.amount}
                    disabled={isPending}
                    onChange={(e) => setRow(i, { amount: groupNumber(parseNumber(e.target.value)) })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Xoá kỳ ${i + 1}`}
                    disabled={isPending || rows.length <= 1}
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setRows((rs) => [...rs, { label: `Đợt ${rs.length + 1}`, dueAt: "", amount: "" }])}
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Thêm kỳ
              </Button>
              <p className={diff === 0 ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
                Tổng: {formatVnd(sum)}
                {diff === 0 ? " — khớp" : diff > 0 ? ` — thừa ${formatVnd(diff)}` : ` — thiếu ${formatVnd(-diff)}`}
              </p>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sale-payee">Bên nhận tiền</Label>
              <Select value={payeeSide} onValueChange={(v) => setPayeeSide(v as SalePayeeSide)} disabled={isPending}>
                <SelectTrigger id="sale-payee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SALE_PAYEE_LABELS) as SalePayeeSide[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {SALE_PAYEE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-bank">Thông tin nhận tiền</Label>
              <Input
                id="sale-bank"
                value={bank}
                disabled={isPending}
                placeholder="Ngân hàng – số tài khoản – chủ tài khoản"
                onChange={(e) => setBank(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-no">Số hợp đồng</Label>
              <Input id="sale-no" value={contractNo} disabled={isPending} onChange={(e) => setContractNo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-signdue">Hạn ký hợp đồng</Label>
              <Input id="sale-signdue" type="date" value={signDue} disabled={isPending} onChange={(e) => setSignDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-hodue">Hạn bàn giao</Label>
              <Input id="sale-hodue" type="date" value={handoverDue} disabled={isPending} onChange={(e) => setHandoverDue(e.target.value)} />
            </div>
          </section>

          <section className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                checked={notarize}
                disabled={isPending}
                onChange={(e) => setNotarize(e.target.checked)}
              />
              Hợp đồng cần công chứng, chứng thực
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                checked={orgSigns}
                disabled={isPending}
                onChange={(e) => setOrgSigns(e.target.checked)}
              />
              Tổ chức đấu giá ký với tư cách bên thứ ba (chứng kiến)
            </label>
          </section>

          {diff !== 0 ? (
            <InfoBox variant="amber">
              Tổng các kỳ phải đúng bằng {formatVnd(payable)} thì mới lưu được.
            </InfoBox>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={diff !== 0 || isPending}
            onClick={() =>
              onSubmit({
                installments: rows.map((r, i) => ({
                  seq: i + 1,
                  label: r.label.trim() || null,
                  due_at: r.dueAt ? new Date(`${r.dueAt}T00:00:00`).toISOString() : null,
                  amount: parseNumber(r.amount),
                })),
                payeeSide,
                payeeBankInfo: bank.trim(),
                contractNo: contractNo.trim(),
                signDueAt: signDue ? new Date(`${signDue}T00:00:00`).toISOString() : null,
                handoverDueAt: handoverDue ? new Date(`${handoverDue}T00:00:00`).toISOString() : null,
                notarizationRequired: notarize,
                orgSigns,
              })
            }
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Lưu điều khoản
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

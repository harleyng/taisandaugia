import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { useSetContractDeposit } from "@/hooks/useOrgBiddingContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { displayNameOf, toDateInput } from "@/lib/biddingContracts/contractDetail";
import { depositActionsFor } from "@/lib/biddingContracts/deposit";
import { cn } from "@/lib/utils";
import {
  DEPOSIT_METHOD_LABELS,
  type ContractWithSession,
  type DepositActionStatus,
  type DepositMethod,
} from "@/types/bidding-contract";
import { DIALOG_BTN } from "./ui";

const INPUT =
  "h-[38px] w-full min-w-0 rounded-lg border-0 bg-card px-[11px] text-[13.5px] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] outline-none focus:shadow-[inset_0_0_0_1px_hsl(var(--primary)),0_0_0_3px_hsl(var(--primary)/0.12)]";
const LABEL = "flex min-w-0 flex-col gap-[5px]";
const CAPTION = "text-[12.5px] font-medium text-muted-foreground";

/** Chuyển ngoài design, giữ trong hộp thoại Sửa (quyết định 2026-10-11). */
type SideAction = Exclude<DepositActionStatus, "received">;
const SIDE: Record<SideAction, { link: string; title: string; confirm: string; hint: string }> = {
  refunded: {
    link: "Ghi nhận đã hoàn trả",
    title: "Ghi nhận đã hoàn trả",
    confirm: "Ghi nhận hoàn trả",
    hint: "Đã chuyển trả tiền đặt trước cho người đăng ký.",
  },
  forfeited: {
    link: "Không hoàn trả (vi phạm quy chế)",
    title: "Không hoàn trả tiền đặt trước",
    confirm: "Xác nhận không hoàn trả",
    hint: "Người đăng ký vi phạm quy chế cuộc đấu giá — bắt buộc ghi lý do.",
  },
  pending: {
    link: "Chuyển về chưa nộp",
    title: "Chuyển về chưa nộp",
    confirm: "Chuyển về chưa nộp",
    hint: "Chỉ dùng khi ghi nhận nhầm. Số báo danh đã cấp (nếu có) sẽ bị thu hồi.",
  },
};

interface Props {
  contract: ContractWithSession;
  required: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Ghi nhận / sửa tiền đặt trước (design openDep) + các chuyển phụ của server. */
export function DepositDialog({ contract: c, required, open, onOpenChange }: Props) {
  const save = useSetContractDeposit();
  const editing = c.deposit_status !== "pending";
  const targets = depositActionsFor(c.deposit_status, {
    sessionCancelled: c.auction_sessions?.status === "cancelled",
    sessionFinalized: !!c.auction_sessions?.finalized_at,
  }).targets;
  const sides = (["refunded", "forfeited", "pending"] as SideAction[]).filter((t) => targets.includes(t));

  const [side, setSide] = useState<SideAction | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<DepositMethod>("bank_transfer");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSide(null);
    const known = c.deposit_amount_received ?? required;
    setAmount(known != null ? String(Math.round(known)) : "");
    setDate(toDateInput(c.deposit_received_at));
    setMethod(c.deposit_method ?? "bank_transfer");
    setRef(c.deposit_txn_ref ?? "");
    setNote("");
    setErr("");
    // Chỉ nạp lại khi mở hộp thoại: refetch nền giữa lúc nhập không được xoá chữ đang gõ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, c.id]);

  const close = () => onOpenChange(false);

  const submitRecord = () => {
    const amt = Number(amount);
    if (!(amt > 0)) return setErr("Nhập số tiền đã nhận.");
    if (!date) return setErr("Chọn ngày nhận.");
    if (date > toDateInput(null)) return setErr("Ngày nhận không được ở tương lai.");
    if (method === "bank_transfer" && !ref.trim()) return setErr("Nhập mã giao dịch để đối soát sao kê.");
    const today = date === toDateInput(null);
    save.mutate(
      {
        contractId: c.id,
        status: "received",
        amount: amt,
        method,
        txnRef: ref.trim(),
        receivedAt: (today ? new Date() : new Date(`${date}T12:00:00`)).toISOString(),
      },
      { onSuccess: close },
    );
  };

  const submitSide = () => {
    if (!side) return;
    if (side === "forfeited" && !note.trim()) return setErr("Nhập lý do không hoàn trả.");
    save.mutate({ contractId: c.id, status: side, note: note.trim() || undefined }, { onSuccess: close });
  };

  const title = side ? SIDE[side].title : editing ? "Sửa tiền đặt trước" : "Ghi nhận tiền đặt trước";

  return (
    <Dialog open={open} onOpenChange={(v) => !save.isPending && onOpenChange(v)}>
      <DialogContent
        className="max-w-[520px] gap-3.5 rounded-[14px] px-[22px] pb-5 pt-[18px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          amountRef.current?.focus();
        }}
      >
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-[13px]">
            {displayNameOf(c)}
            {required != null && (
              <>
                {" "}
                · phải nộp <b className="font-semibold tabular-nums text-foreground">{formatVnd(required)}</b>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {side ? (
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">{SIDE[side].hint}</p>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setErr("");
              }}
              placeholder={side === "forfeited" ? "Lý do không hoàn trả" : "Ghi chú (mã giao dịch hoàn trả, ngày chuyển…)"}
              className="text-[13.5px]"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className={LABEL}>
              <small className={CAPTION}>Số tiền đã nhận</small>
              <NumberInput
                ref={amountRef}
                value={amount}
                onChange={(v) => {
                  setAmount(v);
                  setErr("");
                }}
                allowDecimal={false}
                inputMode="numeric"
                className={cn(INPUT, "tabular-nums")}
              />
            </label>
            <label className={LABEL}>
              <small className={CAPTION}>Ngày nhận</small>
              <input type="date" value={date} max={toDateInput(null)} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </label>
            <label className={LABEL}>
              <small className={CAPTION}>Hình thức</small>
              <select value={method} onChange={(e) => setMethod(e.target.value as DepositMethod)} className={INPUT}>
                {(Object.keys(DEPOSIT_METHOD_LABELS) as DepositMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {DEPOSIT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              <small className={CAPTION}>Mã giao dịch / số chứng từ</small>
              <input
                value={ref}
                maxLength={100}
                onChange={(e) => {
                  setRef(e.target.value);
                  setErr("");
                }}
                placeholder="VD: FT2628…"
                className={cn(INPUT, "font-mono text-[12.5px]")}
              />
            </label>
            <div className={cn(LABEL, "col-span-full")}>
              <small className={CAPTION}>Chứng từ</small>
              {/* Tải chứng từ chưa làm (cần bucket theo tổ chức) — giữ chỗ như design. */}
              <Button type="button" variant="outline" size="sm" disabled className="h-8 self-start rounded-lg text-[12.5px]" title="Sắp có">
                <Upload className="h-4 w-4" />
                Tải ủy nhiệm chi / biên lai
              </Button>
            </div>
          </div>
        )}

        {err && <p className="text-[12.5px] font-medium text-destructive">{err}</p>}

        {!side && editing && sides.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3">
            {sides.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSide(s);
                  setErr("");
                }}
                className={cn(
                  "py-0.5 text-[12.5px] font-semibold",
                  s === "forfeited" ? "text-destructive hover:text-destructive/80" : "text-primary hover:text-primary/80",
                )}
              >
                {SIDE[s].link}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            className={DIALOG_BTN}
            disabled={save.isPending}
            onClick={() => (side ? setSide(null) : close())}
          >
            {side ? "Quay lại" : "Huỷ"}
          </Button>
          {(side || targets.includes("received")) && (
            <Button
              variant={side === "forfeited" ? "destructive" : "default"}
              className={DIALOG_BTN}
              disabled={save.isPending}
              onClick={side ? submitSide : submitRecord}
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {side ? SIDE[side].confirm : "Lưu"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

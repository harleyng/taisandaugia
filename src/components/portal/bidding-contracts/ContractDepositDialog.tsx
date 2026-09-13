import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { DepositStatusBadge } from "@/components/bidding-contracts/DepositStatusBadge";
import { useSetContractDeposit } from "@/hooks/useOrgBiddingContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { depositActionsFor } from "@/lib/biddingContracts/deposit";
import type { ContractWithSession, DepositActionStatus } from "@/types/bidding-contract";

const ACTION_LABELS: Record<DepositActionStatus, string> = {
  received: "Đã nhận tiền đặt trước",
  refunded: "Đã hoàn trả cho người đăng ký",
  forfeited: "Không hoàn trả (vi phạm quy chế cuộc đấu giá)",
  pending: "Chuyển về chưa nhận — sửa nhầm, số báo danh sẽ bị thu hồi",
};

interface Props {
  contract: ContractWithSession | null;
  /** Tổng tiền đặt trước các lô của phiên — gợi ý số tiền (nếu biết). */
  expected?: number | null;
  onOpenChange: (open: boolean) => void;
}

export function ContractDepositDialog({ contract, expected, onOpenChange }: Props) {
  const save = useSetContractDeposit();
  const [target, setTarget] = useState<DepositActionStatus>("received");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const actions = contract
    ? depositActionsFor(contract.deposit_status, {
        sessionCancelled: contract.auction_sessions?.status === "cancelled",
        sessionFinalized: !!contract.auction_sessions?.finalized_at,
      })
    : { targets: [], blockedNote: null };
  const targets = actions.targets;

  useEffect(() => {
    if (!contract) return;
    setTarget(
      depositActionsFor(contract.deposit_status, {
        sessionCancelled: contract.auction_sessions?.status === "cancelled",
        sessionFinalized: !!contract.auction_sessions?.finalized_at,
      }).targets[0] ?? "received",
    );
    const known = contract.deposit_amount_received ?? expected ?? null;
    setAmount(known != null ? String(known) : "");
    setNote(contract.deposit_note ?? "");
  }, [contract, expected]);

  const needsAmount = target === "received";
  const needsNote = target === "forfeited";
  const invalid = targets.length === 0 || (needsAmount && !(Number(amount) > 0)) || (needsNote && !note.trim());

  const submit = () => {
    if (!contract || invalid) return;
    save.mutate(
      {
        contractId: contract.id,
        status: target,
        amount: needsAmount ? Number(amount) : undefined,
        note: note.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={!!contract} onOpenChange={(v) => !save.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tiền đặt trước — {contract?.code}</DialogTitle>
          <DialogDescription>
            {contract?.full_name} · hiện tại: {contract && <DepositStatusBadge status={contract.deposit_status} />}
          </DialogDescription>
        </DialogHeader>

        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{actions.blockedNote}</p>
        ) : (
          <div className="space-y-4 py-1">
            <RadioGroup value={target} onValueChange={(v) => setTarget(v as DepositActionStatus)} className="space-y-2">
              {targets.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <RadioGroupItem value={t} id={`deposit-${t}`} />
                  <Label htmlFor={`deposit-${t}`} className="font-normal">
                    {ACTION_LABELS[t]}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {needsAmount && (
              <div className="space-y-1.5">
                <Label>
                  Số tiền đã nhận (₫) <span className="text-destructive">*</span>
                </Label>
                <NumberInput value={amount} onChange={setAmount} allowDecimal={false} />
                {expected != null && (
                  <p className="text-xs text-muted-foreground">Tổng tiền đặt trước các lô trong phiên: {formatVnd(expected)}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                Ghi chú {needsNote && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={needsNote ? "Lý do không hoàn trả" : "VD: mã giao dịch ngân hàng, ngày chuyển khoản"}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Đóng
          </Button>
          {targets.length > 0 && (
            <Button onClick={submit} disabled={save.isPending || invalid} className="gap-1.5">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Lưu
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

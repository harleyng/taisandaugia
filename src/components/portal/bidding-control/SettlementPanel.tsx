import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import { formatVnd } from "@/lib/advertising/slug";
import { useConfirmWinnerPayment, useMarkDepositRefunded } from "@/hooks/useOrgBidding";
import { useCreateSaleContract, useOrgSaleContracts } from "@/hooks/useSaleContracts";
import { useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";
import { portalSaleContractPath } from "@/lib/saleContracts/files";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem, AuctionSessionWithItems } from "@/types/auction-session";
import type { ContractWithSession } from "@/types/bidding-contract";
import { DepositSettlementTable } from "./DepositSettlementTable";
import { IssueMinutesCard } from "./IssueMinutesCard";
import { WinnerPaymentCard } from "./WinnerPaymentCard";

/**
 * Việc còn lại sau khi chốt kết quả: thanh toán của người trúng, tiền đặt trước,
 * biên bản.
 *
 * Vỏ chứa riêng để BiddingControlRoom chỉ còn lo realtime / đồng hồ / điều hành
 * lô. KHÔNG hook nào ở đây mở kênh realtime — trạng thái lô nhận qua prop từ
 * chỗ mount useLotStates duy nhất.
 *
 * Từ giai đoạn hợp đồng mua bán: đây là nơi tổ chức LẬP hợp đồng cho từng lô đã
 * bán. Quyền lấy theo tổ chức CỦA PHIÊN (useHasOrgPermissionIn), không theo
 * OrgSwitcher — người dùng có thể đang chọn tổ chức khác.
 */

interface Props {
  session: AuctionSessionWithItems;
  lots: AuctionSessionItem[];
  stateByLot: Map<string, LotState>;
  contracts: ContractWithSession[];
  canFinalize: boolean;
  canRefund: boolean;
  now: Date;
}

type PaymentTarget = { lot: AuctionSessionItem; state: LotState | null; paid: boolean };

export function SettlementPanel({ session, lots, stateByLot, contracts, canFinalize, canRefund, now }: Props) {
  const navigate = useNavigate();
  const confirmPayment = useConfirmWinnerPayment(session.id);
  const markRefunded = useMarkDepositRefunded(session.id);
  const canManageSale = useHasOrgPermissionIn(session.organization_id, "hop-dong-mua-ban", "update");
  const { data: saleContracts = [] } = useOrgSaleContracts(session.organization_id);
  const createContract = useCreateSaleContract();

  const [payment, setPayment] = useState<PaymentTarget | null>(null);
  const [refund, setRefund] = useState<ContractWithSession | null>(null);
  const [note, setNote] = useState("");

  /** Chỉ hợp đồng CÒN SỐNG mới chặn nút cũ — lô đã huỷ hợp đồng thì lập lại được. */
  const contractByLot = useMemo(() => {
    const m = new Map<string, (typeof saleContracts)[number]>();
    for (const c of saleContracts) {
      if (c.session_id === session.id && c.status !== "cancelled") m.set(c.lot_id, c);
    }
    return m;
  }, [saleContracts, session.id]);

  const lotsWithoutContract = lots.filter(
    (l) => stateByLot.get(l.id)?.result === "sold" && !contractByLot.has(l.id),
  );

  const closeRefund = () => {
    setRefund(null);
    setNote("");
  };

  return (
    <>
      <WinnerPaymentCard
        lots={lots}
        stateByLot={stateByLot}
        contracts={contracts}
        canFinalize={canFinalize}
        now={now}
        pendingLotId={
          confirmPayment.isPending || createContract.isPending ? payment?.lot.id ?? null : null
        }
        onConfirm={(lot, paid) => setPayment({ lot, state: stateByLot.get(lot.id) ?? null, paid })}
        contractByLot={contractByLot}
        canManageSale={canManageSale}
        onCreateContract={(lot) =>
          createContract.mutate(
            { lotId: lot.id, sessionId: session.id },
            { onSuccess: (res) => navigate(portalSaleContractPath(res.id)) },
          )
        }
        onOpenContract={(c) => navigate(portalSaleContractPath(c.id))}
      />

      {canManageSale && lotsWithoutContract.length >= 2 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">
            Còn {lotsWithoutContract.length} lô đã bán chưa có hợp đồng mua bán.
          </p>
          <Button
            size="sm"
            disabled={createContract.isPending}
            onClick={() => {
              // Tuần tự chứ không Promise.all: mỗi lô là một RPC có khoá tư vấn
              // riêng, bắn song song chỉ làm chúng xếp hàng chờ nhau. Một lô lỗi
              // (vd. `seller_unresolved`) không được chặn các lô còn lại.
              void (async () => {
                for (const lot of lotsWithoutContract) {
                  try {
                    await createContract.mutateAsync({ lotId: lot.id, sessionId: session.id });
                  } catch {
                    /* toast đã hiện trong onError của mutation */
                  }
                }
              })();
            }}
          >
            {createContract.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Tạo hợp đồng cho tất cả lô đã bán
          </Button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <DepositSettlementTable
          contracts={contracts}
          canRefund={canRefund}
          pendingContractId={markRefunded.isPending ? refund?.id ?? null : null}
          onRefund={setRefund}
        />
        <IssueMinutesCard
          session={session}
          lots={lots}
          stateByLot={stateByLot}
          contracts={contracts}
          canFinalize={canFinalize}
        />
      </div>

      {/* org_confirm_winner_payment MỘT CHIỀU: lô đã ghi nhận không sửa lại
          được, và "không thanh toán" tịch thu luôn tiền đặt trước. */}
      <Dialog open={!!payment} onOpenChange={(next) => !confirmPayment.isPending && !next && setPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {payment?.paid ? "Xác nhận đã thanh toán?" : "Ghi nhận không thanh toán?"}
            </DialogTitle>
            <DialogDescription>
              Lô {payment?.lot.lot_no} · {payment?.lot.title}
              {payment?.state?.winning_amount != null && ` — giá trúng ${formatVnd(payment.state.winning_amount)}`}
            </DialogDescription>
          </DialogHeader>

          <InfoBox variant={payment?.paid ? "muted" : "amber"} className="text-sm">
            {payment?.paid
              ? "Ghi nhận xong không sửa lại được. Chỉ xác nhận khi đã nhận đủ tiền."
              : "Ghi nhận xong không sửa lại được. Tiền đặt trước của người trúng sẽ bị tịch thu, không hoàn trả."}
          </InfoBox>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayment(null)} disabled={confirmPayment.isPending}>
              Huỷ
            </Button>
            <Button
              variant={payment?.paid ? "default" : "destructive"}
              className="gap-1.5"
              disabled={confirmPayment.isPending}
              onClick={() =>
                payment &&
                confirmPayment.mutate(
                  { lotId: payment.lot.id, paid: payment.paid },
                  { onSuccess: () => setPayment(null) },
                )
              }
            >
              {confirmPayment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {payment?.paid ? "Đã thanh toán" : "Không thanh toán"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!refund} onOpenChange={(next) => !markRefunded.isPending && !next && closeRefund()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ghi nhận đã hoàn trả tiền đặt trước?</DialogTitle>
            <DialogDescription>
              {refund?.full_name}
              {refund?.deposit_amount_received != null && ` — ${formatVnd(refund.deposit_amount_received)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: mã giao dịch ngân hàng, ngày chuyển khoản"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRefund} disabled={markRefunded.isPending}>
              Huỷ
            </Button>
            <Button
              className="gap-1.5"
              disabled={markRefunded.isPending}
              onClick={() =>
                refund &&
                markRefunded.mutate(
                  { contractId: refund.id, note: note.trim() || undefined },
                  { onSuccess: closeRefund },
                )
              }
            >
              {markRefunded.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Đã hoàn trả
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

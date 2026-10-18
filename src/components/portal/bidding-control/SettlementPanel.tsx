import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoBox } from "@/components/shared/InfoBox";
import { DetailCard, DetailCardFooter } from "@/components/portal/auction-sessions/DetailCard";
import { DotPill, type PillTone } from "@/components/portal/auction-sessions/list/SessionStatePill";
import { DESIGN_BTN } from "@/components/portal/auction-sessions/SessionDetailHero";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import { formatMoneyShort } from "@/utils/money";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { LOT_VIEW_LABELS, type LotViewKey } from "@/lib/bidding/controlView";
import { useConfirmWinnerPayment } from "@/hooks/useOrgBidding";
import { useOrgSaleContracts } from "@/hooks/useSaleContracts";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem, AuctionSessionWithItems } from "@/types/auction-session";
import type { ContractWithSession } from "@/types/bidding-contract";
import { IssueMinutesDialog } from "./IssueMinutesDialog";

/**
 * Sau khi chốt kết quả (design pdg-ops `endedView`): 4 chỉ số + danh sách
 * "Kết quả & thanh toán" mỗi lô một dòng + nút "Biên bản đấu giá".
 *
 * org_confirm_winner_payment MỘT CHIỀU và từ chối `sale_contract_exists` khi lô
 * đã có hợp đồng mua bán (sổ tiền của hợp đồng là sự thật) — nên lúc đó nút tắt
 * kèm lý do. Hợp đồng lập ở tab Hồ sơ tham gia (design `saleCard`).
 */

const TONE: Record<LotViewKey, PillTone> = {
  wait: "muted",
  live: "live",
  paused: "warning",
  tied: "warning",
  won: "ok",
  unsold: "warning",
  pulled: "muted",
  closed: "muted",
};

interface Props {
  session: AuctionSessionWithItems;
  lots: { lot: AuctionSessionItem; state: LotState | null; key: LotViewKey }[];
  stateByLot: Map<string, LotState>;
  contracts: ContractWithSession[];
  canFinalize: boolean;
}

export function SettlementPanel({ session, lots, stateByLot, contracts, canFinalize }: Props) {
  const confirmPayment = useConfirmWinnerPayment(session.id);
  const { data: saleContracts = [] } = useOrgSaleContracts(session.organization_id);
  const [target, setTarget] = useState<AuctionSessionItem | null>(null);
  const [minutesOpen, setMinutesOpen] = useState(false);

  /** Chỉ hợp đồng CÒN SỐNG mới chặn — lô đã huỷ hợp đồng thì ghi nhận được. */
  const lotsWithSale = useMemo(
    () =>
      new Set(saleContracts.filter((c) => c.session_id === session.id && c.status !== "cancelled").map((c) => c.lot_id)),
    [saleContracts, session.id],
  );
  const byId = new Map(contracts.map((c) => [c.id, c]));

  const won = lots.filter((l) => l.key === "won" && l.state?.winning_amount != null);
  const total = won.reduce((a, l) => a + (l.state?.winning_amount ?? 0), 0);
  const base = won.reduce((a, l) => a + (l.lot.starting_price ?? 0), 0);
  const refunded = contracts.filter((c) => c.status === "paid" && c.deposit_status === "refunded").length;
  const winning = target ? stateByLot.get(target.id)?.winning_amount : null;

  const confirm = (paid: boolean) =>
    target && confirmPayment.mutate({ lotId: target.id, paid }, { onSuccess: () => setTarget(null) });

  const kpis: [string, string, string?][] = [
    ["Tài sản thành công", String(won.length), ` / ${lots.length}`],
    ["Tổng giá trúng", formatMoneyShort(total)],
    ["Chênh so với khởi điểm", `+${base ? Math.round((total / base - 1) * 100) : 0}%`],
    ["Hoàn trả đặt trước", String(refunded), " người"],
  ];

  return (
    <>
      <section className="grid grid-cols-1 rounded-2xl bg-card shadow-card sm:grid-flow-col sm:auto-cols-fr">
        {kpis.map(([k, v, em]) => (
          <div key={k} className="border-t px-6 py-3.5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <small className="block text-xs text-muted-foreground">{k}</small>
            <strong className="mt-0.5 block text-xl font-bold tabular-nums tracking-[-0.015em] text-foreground">
              {v}
              {em && <em className="text-[13px] font-medium not-italic text-muted-foreground">{em}</em>}
            </strong>
          </div>
        ))}
      </section>

      <DetailCard title="Kết quả & thanh toán">
        <ol className="m-0 list-none px-3 pb-2.5 pt-1.5">
          {lots.map(({ lot, state, key }) => {
            const winner = state?.winner_contract_id ? byId.get(state.winner_contract_id) : undefined;
            const status = state?.payment_status;
            const hasSale = lotsWithSale.has(lot.id);
            return (
              <li
                key={lot.id}
                className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 border-t px-2.5 py-3 first:border-t-0"
              >
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-lg text-[12.5px] font-bold tabular-nums",
                    key === "won" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {lot.lot_no}
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-[13px] font-medium text-muted-foreground">{lot.title}</b>
                  <small className="text-xs tabular-nums text-muted-foreground">
                    {key === "won" && state?.winning_amount != null
                      ? `Trúng ${formatVnd(state.winning_amount)} · SBD ${formatBidderNo(winner?.bidder_no ?? state.leading_bidder_no) ?? "—"}`
                      : LOT_VIEW_LABELS[key]}
                  </small>
                </span>
                <span className="text-right">
                  {key !== "won" ? (
                    <DotPill tone={TONE[key]}>{LOT_VIEW_LABELS[key]}</DotPill>
                  ) : status === "paid" ? (
                    <DotPill tone="ok">Đã thanh toán</DotPill>
                  ) : status === "defaulted" ? (
                    <DotPill tone="bad">Không thanh toán</DotPill>
                  ) : canFinalize ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg px-[11px] text-[12.5px] font-semibold"
                      disabled={hasSale || (confirmPayment.isPending && target?.id === lot.id)}
                      title={hasSale ? "Tài sản đã có hợp đồng mua bán — ghi nhận thanh toán trong hợp đồng" : undefined}
                      onClick={() => setTarget(lot)}
                    >
                      Xác nhận thanh toán
                    </Button>
                  ) : (
                    <DotPill tone="warning">Chờ thanh toán</DotPill>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        <DetailCardFooter>
          <span className="flex-1" />
          <Button variant="outline" className={DESIGN_BTN} onClick={() => setMinutesOpen(true)}>
            <Download className="h-4 w-4" />
            Biên bản đấu giá
          </Button>
        </DetailCardFooter>
      </DetailCard>

      <IssueMinutesDialog
        open={minutesOpen}
        onOpenChange={setMinutesOpen}
        session={session}
        lots={lots.map((l) => l.lot)}
        stateByLot={stateByLot}
        contracts={contracts}
        canFinalize={canFinalize}
      />

      {/* MỘT CHIỀU: ghi nhận xong không sửa lại được, và "không thanh toán"
          tịch thu luôn tiền đặt trước. */}
      <Dialog open={!!target} onOpenChange={(next) => !confirmPayment.isPending && !next && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận thanh toán</DialogTitle>
            <DialogDescription>
              Tài sản {target?.lot_no} · {target?.title}
              {winning != null && ` — giá trúng ${formatVnd(winning)}`}
            </DialogDescription>
          </DialogHeader>

          <InfoBox variant="amber" className="text-sm">
            Ghi nhận xong không sửa lại được. Chỉ xác nhận khi đã nhận đủ tiền. Chọn “Không thanh toán” nếu người trúng
            bỏ cuộc — tiền đặt trước của họ bị tịch thu, không hoàn trả.
          </InfoBox>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={confirmPayment.isPending}
              onClick={() => confirm(false)}
            >
              Không thanh toán
            </Button>
            <Button className="gap-1.5" disabled={confirmPayment.isPending} onClick={() => confirm(true)}>
              {confirmPayment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Đã thanh toán
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

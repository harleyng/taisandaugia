import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSessionLotResults } from "@/hooks/useLotStates";
import { useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";
import { useCreateSaleContract, useOrgSaleContracts } from "@/hooks/useSaleContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { portalSaleContractPath } from "@/lib/saleContracts/files";
import { saleStageOf } from "@/lib/saleContracts/stage";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import type { ContractWithSession } from "@/types/bidding-contract";
import { DetailRow, DetailRows } from "./DetailCard";
import { DotPill } from "./list/SessionStatePill";

/**
 * "Hợp đồng mua bán với người trúng" (design `saleCard` trong tab Hồ sơ tham gia):
 * mỗi lô đã bán một dòng — chưa có hợp đồng thì "Lập hợp đồng", có rồi thì Đã ký /
 * Chờ ký (bấm để mở hợp đồng). Chỉ hiện sau khi chốt kết quả và có lô đã bán.
 *
 * Quyền lập hợp đồng theo tổ chức CỦA PHIÊN (useHasOrgPermissionIn), không theo
 * OrgSwitcher. Hợp đồng đã huỷ coi như chưa có — lập lại được.
 */
export function SessionSaleContractsCard({
  session,
  contracts,
}: {
  session: AuctionSessionWithItems;
  contracts: ContractWithSession[];
}) {
  const navigate = useNavigate();
  const { data: states = [] } = useSessionLotResults(session.id);
  const { data: all = [] } = useOrgSaleContracts(session.organization_id);
  const canManage = useHasOrgPermissionIn(session.organization_id, "hop-dong-mua-ban", "update");
  const create = useCreateSaleContract();
  const [creatingLotId, setCreatingLotId] = useState<string | null>(null);

  const saleByLot = useMemo(() => {
    const m = new Map<string, (typeof all)[number]>();
    for (const c of all) if (c.session_id === session.id && c.status !== "cancelled") m.set(c.lot_id, c);
    return m;
  }, [all, session.id]);

  const stateByLot = new Map(states.map((s) => [s.lot_id, s]));
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const won = (session.auction_session_items ?? [])
    .map((lot) => ({ lot, state: stateByLot.get(lot.id) }))
    .filter((r) => r.state?.result === "sold");
  if (!won.length) return null;
  const todo = won.filter((r) => !saleByLot.has(r.lot.id)).length;

  return (
    <section className="rounded-2xl bg-card shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-[22px] pb-1 pt-5">
        <h2 className="text-base font-semibold tracking-[-0.005em] text-foreground">Hợp đồng mua bán với người trúng</h2>
        {todo ? (
          <span className="rounded-full bg-[hsl(var(--tier-warn-bg))] px-[9px] py-0.5 text-xs font-semibold text-[hsl(var(--tier-warn-strong))]">
            {todo} lô chưa lập
          </span>
        ) : (
          <span className="text-[13px] text-muted-foreground">Đủ hợp đồng</span>
        )}
      </div>
      <DetailRows className="pb-3">
        {won.map(({ lot, state }) => {
          const w = state?.winner_contract_id ? byId.get(state.winner_contract_id) : undefined;
          const sale = saleByLot.get(lot.id);
          const signed = sale && saleStageOf(sale) !== "signing";
          return (
            <DetailRow
              key={lot.id}
              title={<span className="block truncate">{`Lô ${lot.lot_no} · ${lot.title}`}</span>}
              sub={
                <span className="tabular-nums">
                  {[
                    w?.bidder_no != null ? `SBD ${formatBidderNo(w.bidder_no)}` : null,
                    w ? w.org_name ?? w.full_name : null,
                    state?.winning_amount != null ? `trúng ${formatVnd(state.winning_amount)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              }
              value={
                sale ? (
                  <button type="button" onClick={() => navigate(portalSaleContractPath(sale.id))}>
                    <DotPill tone={signed ? "ok" : "info"}>{signed ? "Đã ký" : "Chờ ký"}</DotPill>
                  </button>
                ) : canManage ? (
                  <Button
                    size="sm"
                    className="h-8 rounded-lg px-[11px] text-[12.5px] font-semibold"
                    disabled={create.isPending && creatingLotId === lot.id}
                    onClick={() => {
                      setCreatingLotId(lot.id);
                      create.mutate(
                        { lotId: lot.id, sessionId: session.id },
                        {
                          onSuccess: (res) => navigate(portalSaleContractPath(res.id)),
                          onSettled: () => setCreatingLotId(null),
                        },
                      );
                    }}
                  >
                    Lập hợp đồng
                  </Button>
                ) : (
                  <DotPill tone="muted">Chưa lập</DotPill>
                )
              }
            />
          );
        })}
      </DetailRows>
    </section>
  );
}

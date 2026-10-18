import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PillTabs } from "@/components/buyer-contracts/BuyerPageShell";
import { CheckinOpenBanner } from "@/components/buyer-contracts/CheckinOpenBanner";
import { MyContractRow } from "@/components/buyer-contracts/MyContractRow";
import { CheckinDialogs, type CheckinDialogKind } from "@/components/bidder-checkin/CheckinDialogs";
import { registeredLotsOf, useMyContracts, type MyContract } from "@/hooks/useBuyerContracts";
import { useServerNow } from "@/hooks/useServerClock";
import { useMyWonLots } from "@/hooks/useBiddingContracts";
import { BUYER_GROUPS, buyerGroupOf, type BuyerGroup } from "@/lib/biddingContracts/buyerContract";
import { MY_CONTRACTS_GROUP_PARAM } from "@/lib/biddingContracts/paths";

const EMPTY: Record<BuyerGroup, string> = {
  active: "Bạn chưa có hồ sơ nào đang tham gia.",
  done: "Chưa có phiên nào bạn tham gia đã kết thúc.",
  cancelled: "Không có hồ sơ nào bị huỷ.",
};

/**
 * "Hồ sơ đấu giá" trong trang hồ sơ cá nhân (/profile?tab=auction-contracts) — hồ sơ
 * tham gia các phiên đấu giá người dùng đã mua. Nhóm nằm ở `?nhom=` vì `?tab=` là
 * tab của trang hồ sơ cá nhân.
 */
export const AuctionContractsTab = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const groupParam = params.get(MY_CONTRACTS_GROUP_PARAM);
  const tab = (BUYER_GROUPS.some((g) => g.key === groupParam) ? groupParam : "active") as BuyerGroup;
  const setTab = (k: BuyerGroup) => {
    const next = new URLSearchParams(params);
    if (k === "active") next.delete(MY_CONTRACTS_GROUP_PARAM);
    else next.set(MY_CONTRACTS_GROUP_PARAM, k);
    setParams(next, { replace: true });
  };
  const { data: rows, isLoading } = useMyContracts();
  const data = useMemo(() => rows ?? [], [rows]);
  // Giờ máy chủ: cửa sổ điểm danh do server chấm (băng "Đang mở điểm danh", nút Điểm danh ngay).
  const now = useServerNow(30_000);
  const [dialog, setDialog] = useState<{ kind: CheckinDialogKind | null; contract: MyContract } | null>(null);
  const openDialog = (kind: "checkin" | "ticket", contract: MyContract) => setDialog({ kind, contract });

  const paidIds = useMemo(() => data.filter((c) => c.status === "paid").map((c) => c.id), [data]);
  const { data: wonLots = [] } = useMyWonLots(paidIds);
  const wonCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of wonLots) m.set(l.winner_contract_id, (m.get(l.winner_contract_id) ?? 0) + 1);
    return m;
  }, [wonLots]);

  const grouped = useMemo(() => {
    const g: Record<BuyerGroup, typeof data> = { active: [], done: [], cancelled: [] };
    for (const c of data) {
      const k = buyerGroupOf(c, now);
      if (k) g[k].push(c);
    }
    return g;
  }, [data, now]);
  const list = grouped[tab];

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-[-0.015em] text-foreground">Hồ sơ đấu giá</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Hồ sơ tham gia các phiên đấu giá bạn đã mua.</p>
      </div>
      {tab === "active" && <CheckinOpenBanner contracts={grouped.active} now={now} onOpen={openDialog} />}
      <PillTabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={BUYER_GROUPS.map((g) => ({ ...g, count: grouped[g.key].length }))}
      />
      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 text-center">
          <FileSignature className="h-9 w-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{EMPTY[tab]}</p>
          <Button variant="secondary" onClick={() => navigate("/sessions")}>
            Xem các phiên đấu giá
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((c) => (
            <MyContractRow
              key={c.id}
              contract={c}
              wonCount={wonCount.get(c.id) ?? 0}
              now={now}
              onDialog={openDialog}
            />
          ))}
        </div>
      )}
      {/* Giữ hồ sơ đã chọn khi đóng để modal đóng có hiệu ứng, và modal OTP còn ở lại hiện số báo danh. */}
      {dialog?.contract.auction_sessions && (
        <CheckinDialogs
          kind={dialog.kind}
          onClose={() => setDialog((d) => (d ? { ...d, kind: null } : d))}
          contract={dialog.contract}
          session={dialog.contract.auction_sessions}
          lotNos={registeredLotsOf(dialog.contract).map((l) => l.lot_no)}
        />
      )}
    </div>
  );
};

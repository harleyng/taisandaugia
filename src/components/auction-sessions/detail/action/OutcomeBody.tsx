import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMyWonLots } from "@/hooks/useBiddingContracts";
import { useMySaleContracts } from "@/hooks/useSaleContracts";
import { hasOnlineRoom, type JourneyPhase } from "@/lib/auctionSessions/buyerJourney";
import { MY_CONTRACTS_PATH, myContractPath } from "@/lib/biddingContracts/paths";
import { registeredLotsOf, useMyContracts } from "@/hooks/useBuyerContracts";
import { saleContractPath } from "@/lib/saleContracts/files";
import { formatMoneyFull } from "@/utils/money";
import type { PublicSessionDetail } from "@/types/auction-session";
import type { BiddingContract } from "@/types/bidding-contract";
import { KvBox, Note, Pill } from "../ui";
import { BTN } from "../buttonStyles";

interface Props {
  phase: Extract<JourneyPhase, "live" | "awaiting_result" | "final" | "cancelled">;
  session: PublicSessionDetail;
  /** Hồ sơ đã trả tiền của người xem (null = người xem không tham gia). */
  contract: BiddingContract | null;
  liveLotNo: number | null;
}

/** Người xem đang theo dõi phiên, chờ chốt, kết quả của bạn, hoặc phiên đã huỷ. */
export function OutcomeBody({ phase, session, contract, liveLotNo }: Props) {
  const navigate = useNavigate();
  const online = hasOnlineRoom(session.auction_format);
  const roomPath = `/sessions/${session.id}/dau-gia`;
  const { data: won = [] } = useMyWonLots(phase === "final" && contract ? [contract.id] : []);
  const { data: saleContracts = [] } = useMySaleContracts();
  const { data: myContracts = [] } = useMyContracts();

  const roomBtn = online ? (
    <Button className={BTN.soft} onClick={() => navigate(roomPath)}>
      Xem diễn biến đấu giá
    </Button>
  ) : null;
  const otherSessions = (
    <Button className={BTN.ghost} onClick={() => navigate("/sessions")}>
      Xem các phiên khác
    </Button>
  );

  switch (phase) {
    case "cancelled":
      return (
        <>
          <p className="m-0 text-xs text-muted-foreground">
            Nếu bạn đã nộp tiền đặt trước, tổ chức đấu giá sẽ liên hệ hoàn trả.
          </p>
          <Button className={BTN.soft} onClick={() => navigate("/sessions")}>
            Xem các phiên khác
          </Button>
        </>
      );

    case "live":
      return online ? (
        <>
          <span className="text-center text-xs text-muted-foreground">
            {liveLotNo != null ? `Tài sản ${liveLotNo} đang được đấu giá` : "Phiên đang diễn ra"}
          </span>
          {!contract && <Note>Bạn không có hồ sơ tham gia phiên này — vẫn có thể theo dõi diễn biến trả giá.</Note>}
          <Button className={BTN.primary} onClick={() => navigate(roomPath)}>
            Xem phòng đấu giá
          </Button>
        </>
      ) : (
        <Note>Phiên đang diễn ra tại {session.venue ?? "địa điểm tổ chức"}.</Note>
      );

    case "awaiting_result":
      return (
        <>
          <Note>Phiên đã kết thúc — tổ chức đấu giá đang chốt kết quả.</Note>
          {roomBtn}
        </>
      );

    default: {
      if (!contract) {
        return (
          <>
            <Note>Phiên đã chốt kết quả — xem kết quả từng tài sản trong mục “Kết quả đấu giá”.</Note>
            {roomBtn}
            {otherSessions}
          </>
        );
      }
      // Chỉ những lô hồ sơ đã đăng ký (auction_contract_lots rỗng = mọi lô).
      const full = myContracts.find((c) => c.id === contract.id);
      const lots = full ? registeredLotsOf(full) : (session.auction_session_items ?? []);
      if (won.length === 0) {
        return (
          <>
            <KvBox rows={lots.map((l) => ({ label: `Tài sản ${l.lot_no}`, value: <Pill tone="muted">Không trúng</Pill> }))} />
            <Note>
              Bạn không trúng tài sản nào.
              {contract.deposit_amount_received != null && (
                <>
                  {" "}Tiền đặt trước <b className="text-foreground">{formatMoneyFull(contract.deposit_amount_received)}</b>
                </>
              )}
              {contract.deposit_amount_received != null ? " được" : " Tiền đặt trước được"} hoàn trong 3 ngày làm việc.
            </Note>
            {roomBtn}
            {otherSessions}
          </>
        );
      }
      const total = won.reduce((s, l) => s + (l.winning_amount ?? 0), 0);
      const wonIds = new Set(won.map((l) => l.lot_id));
      const mine = saleContracts.filter((c) => c.status !== "cancelled" && wonIds.has(c.lot_id));
      return (
        <>
          <KvBox
            rows={won.flatMap((l, i) => [
              ...(i > 0 ? [{ label: <span className="block h-1" />, value: null as React.ReactNode }] : []),
              { label: `Tài sản ${l.auction_session_items?.lot_no ?? "—"}`, value: <Pill tone="ok">Bạn trúng</Pill> },
              { label: "Giá trúng", value: <b>{formatMoneyFull(l.winning_amount)}</b> },
            ])}
          />
          {won.length > 1 && (
            <KvBox
              rows={[
                {
                  label: `Tổng giá trúng (${won.length} tài sản)`,
                  value: <b className="text-base">{formatMoneyFull(total)}</b>,
                },
              ]}
            />
          )}
          <p className="m-0 text-xs text-muted-foreground">
            {won.length > 1 ? "Mỗi tài sản trúng có hợp đồng mua bán riêng. " : ""}
            {mine.length === 0 ? "Tổ chức đấu giá sẽ gửi hợp đồng mua bán cho bạn. " : ""}
            Tiền đặt trước các tài sản không trúng được hoàn trong 3 ngày làm việc.
          </p>
          {mine.length > 0 ? (
            <Button
              className={BTN.primary}
              onClick={() => navigate(mine.length === 1 ? saleContractPath(mine[0].id) : MY_CONTRACTS_PATH)}
            >
              Xem hợp đồng mua bán{mine.length > 1 ? ` (${mine.length})` : ""}
            </Button>
          ) : (
            <Button className={BTN.primary} onClick={() => navigate(myContractPath(contract.code))}>
              Xem hồ sơ của tôi
            </Button>
          )}
          {roomBtn}
        </>
      );
    }
  }
}

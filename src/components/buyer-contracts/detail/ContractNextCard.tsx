import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BidderNoBox, KvBox, Note } from "@/components/auction-sessions/detail/ui";
import { BTN } from "@/components/auction-sessions/detail/buttonStyles";
import { ResubmitContractDialog } from "@/components/bidding-contracts/ResubmitContractDialog";
import { WonLotsNotice } from "@/components/bidding-contracts/WonLotsNotice";
import { useCancelBiddingContract, type MyWonLot } from "@/hooks/useBiddingContracts";
import { registeredLotsOf, type MyContract } from "@/hooks/useBuyerContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { BUYER_DEPOSIT_TAGS, buyerDepositStateOf, buyerGroupOf, headlineOf, isLiveFor } from "@/lib/biddingContracts/buyerContract";
import { formatBidderNo, myContractDepositPath, sessionRegistrationPath } from "@/lib/biddingContracts/paths";
import { TagPill } from "../ui";
import { CheckinNextCard } from "./CheckinNextCard";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
    <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
    {children}
  </section>
);

interface Props {
  contract: MyContract;
  wonLots: MyWonLot[];
  now: Date;
  /** Mở sẵn dialog bổ sung (?bo-sung=1 từ danh sách). */
  openResubmit?: boolean;
}

/** Cột phải trang chi tiết hồ sơ: việc người mua cần làm tiếp ở chặng hiện tại. */
export function ContractNextCard({ contract: c, wonLots, now, openResubmit }: Props) {
  const navigate = useNavigate();
  const cancel = useCancelBiddingContract();
  const [resubmit, setResubmit] = useState(false);
  useEffect(() => {
    if (openResubmit && c.review_status === "needs_info") setResubmit(true);
  }, [openResubmit, c.review_status]);

  const s = c.auction_sessions;
  if (!s) return null;
  const group = buyerGroupOf(c, now);
  const dep = buyerDepositStateOf(c);
  const due = registeredLotsOf(c).reduce((a, l) => a + (l.deposit_amount ?? 0), 0);

  if (c.status === "pending_payment") {
    const holding = c.hold_expires_at && Date.parse(c.hold_expires_at) > now.getTime();
    return (
      <Card title="Chờ thanh toán">
        <p className="text-xs text-muted-foreground">
          {holding
            ? `Hồ sơ giữ suất đến ${formatDateTime(c.hold_expires_at)}. Quá giờ, suất được trả lại.`
            : "Đã hết giờ giữ suất. Thanh toán lại để giữ suất mới nếu phiên còn chỗ."}
        </p>
        <Button className={BTN.primary} onClick={() => navigate(sessionRegistrationPath(s.id))}>
          Tiếp tục thanh toán
        </Button>
        <Button className={BTN.ghost} disabled={cancel.isPending} onClick={() => cancel.mutate(c.id)}>
          Huỷ hồ sơ
        </Button>
      </Card>
    );
  }

  if (group === "cancelled") {
    return (
      <Card title={headlineOf(c, { now }).label}>
        <p className="text-xs text-muted-foreground">
          {c.status === "refunded"
            ? `Tổ chức đã từ chối hồ sơ${c.review_note ? `: ${c.review_note}` : ""}. Phí hồ sơ được hoàn lại.`
            : "Phiên đấu giá đã bị huỷ. Tổ chức đấu giá hoàn trả tiền đặt trước đã nộp (nếu có)."}
        </p>
        <Button className={BTN.soft} onClick={() => navigate(`/sessions/${s.id}`)}>
          Về trang phiên
        </Button>
      </Card>
    );
  }

  // Vắng mặt: thẻ riêng (gửi lý do / đã miễn trừ) kể cả khi phiên đã kết thúc.
  if (c.absent_at) return <CheckinNextCard contract={c} />;

  if (group === "done") {
    return (
      <Card title="Kết quả">
        <KvBox
          rows={[
            { label: "Kết quả", value: <TagPill tag={headlineOf(c, { now, wonCount: wonLots.length })} /> },
            { label: "Tiền đặt trước", value: <TagPill tag={BUYER_DEPOSIT_TAGS[dep]} /> },
          ]}
        />
        <WonLotsNotice lots={wonLots} />
        <Button className={BTN.primary} onClick={() => navigate(`/sessions/${s.id}`)}>
          Xem kết quả phiên
        </Button>
      </Card>
    );
  }

  if (isLiveFor(c, now)) {
    return (
      <Card title="Phòng đấu giá">
        <BidderNoBox no={formatBidderNo(c.bidder_no) ?? "—"} caption="Dùng khi trả giá" />
        <Button className={BTN.primaryLg} onClick={() => navigate(`/sessions/${s.id}/dau-gia`)}>
          Vào phòng đấu giá
        </Button>
      </Card>
    );
  }

  if (c.review_status === "needs_info") {
    return (
      <Card title="Bổ sung giấy tờ">
        <Note tone="amber">
          <b>Tổ chức yêu cầu:</b> {c.review_note || "Bổ sung hoặc chụp lại giấy tờ theo hướng dẫn."}
        </Note>
        <Button className={BTN.primary} onClick={() => setResubmit(true)}>
          Bổ sung giấy tờ
        </Button>
        <ResubmitContractDialog contract={c} open={resubmit} onOpenChange={setResubmit} />
      </Card>
    );
  }

  if (dep === "pending" || dep === "sent") {
    return (
      <Card title={dep === "pending" ? "Nộp tiền đặt trước" : "Chờ đối soát tiền đặt trước"}>
        {dep === "pending" ? (
          <KvBox
            rows={[
              { label: "Số tiền", value: <b>{formatVnd(due)}</b> },
              { label: "Hạn nộp", value: formatDateTime(s.registration_end_at) },
            ]}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Bạn báo đã nộp lúc {formatDateTime(c.deposit_reported_at)}. Tổ chức xác nhận trong giờ làm việc.
          </p>
        )}
        {c.review_status === "pending" && <Note>Tổ chức đang duyệt hồ sơ — thường trong 1 ngày làm việc.</Note>}
        <Button
          className={dep === "pending" ? BTN.primary : BTN.soft}
          onClick={() => navigate(myContractDepositPath(c.code))}
        >
          Xem hướng dẫn nộp
        </Button>
      </Card>
    );
  }

  if (c.review_status === "pending") {
    return (
      <Card title="Chờ tổ chức duyệt">
        <p className="text-xs text-muted-foreground">
          Tổ chức đấu giá đang duyệt hồ sơ, thường trong 1 ngày làm việc. Hồ sơ cần đã duyệt và đã nhận tiền đặt trước
          mới được điểm danh.
        </p>
      </Card>
    );
  }

  // Đủ điều kiện: trực tuyến tự điểm danh (OTP); trực tiếp mở phiếu QR tại hội trường.
  return <CheckinNextCard contract={c} />;
}

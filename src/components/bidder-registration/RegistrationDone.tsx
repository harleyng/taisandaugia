import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useContractDepositInfo } from "@/hooks/useBuyerContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { checkinChannelOf, checkinWindowOf } from "@/lib/biddingContracts/checkinWindow";
import { myContractDepositPath, myContractPath } from "@/lib/biddingContracts/paths";
import type { PublicSessionDetail } from "@/types/auction-session";
import type { BiddingContract } from "@/types/bidding-contract";

/** Màn "Đã mua hồ sơ tham gia" sau khi VNPay quay về (?ho-so=). */
export function RegistrationDone({ contract: c, session }: { contract: BiddingContract; session: PublicSessionDetail }) {
  const navigate = useNavigate();
  const { data: info } = useContractDepositInfo(c.id);
  const w = checkinWindowOf(session);
  const online = checkinChannelOf(session.auction_format) === "online";
  const steps = [
    { title: "Tổ chức duyệt hồ sơ", sub: "Thường trong 1 ngày làm việc. Trạng thái cập nhật trong Hồ sơ đấu giá ở trang cá nhân." },
    {
      title: `Nộp tiền đặt trước${info ? ` ${formatVnd(info.deposit_due)}` : ""}`,
      sub: `Hạn ${formatDateTime(session.registration_end_at)} · chuyển khoản, tiền mặt hoặc thư bảo lãnh`,
    },
    {
      title: online ? "Điểm danh trực tuyến" : "Điểm danh tại địa điểm",
      sub: `${formatDateTime(w.opensAt.toISOString())} → ${formatDateTime(w.closesAt.toISOString())} · nhận số báo danh để ${online ? "vào phòng đấu giá" : "dự phiên"}`,
    },
  ];

  return (
    <div className="mx-auto my-6 flex max-w-[640px] flex-col items-center gap-2 rounded-2xl bg-card p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
        <Check className="h-7 w-7 text-success" strokeWidth={2.5} />
      </span>
      <h1 className="text-[28px] font-bold leading-tight text-foreground">Đã mua hồ sơ tham gia</h1>
      <p className="text-sm text-muted-foreground">
        Mã hồ sơ <b className="font-mono text-foreground">{c.code}</b>
      </p>
      <div className="mb-2 mt-4 w-full rounded-[14px] bg-muted p-4 text-left">
        <h3 className="text-[15px] font-semibold text-foreground">Tiếp theo</h3>
        <ol className="mt-2.5 flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  i === 0 ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
                )}
              >
                {i + 1}
              </span>
              <div>
                <b className="block text-foreground">{s.title}</b>
                <span className="text-xs text-muted-foreground">{s.sub}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button className="h-11 text-[15px] font-semibold" onClick={() => navigate(myContractDepositPath(c.code))}>
          Xem hướng dẫn nộp đặt trước
        </Button>
        <Button
          variant="secondary"
          className="h-11 bg-primary/10 text-[15px] font-semibold text-primary hover:bg-primary/15"
          onClick={() => navigate(myContractPath(c.code))}
        >
          Xem hồ sơ của tôi
        </Button>
      </div>
    </div>
  );
}

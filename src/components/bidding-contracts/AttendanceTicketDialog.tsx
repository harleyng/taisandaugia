import { useNavigate } from "react-router-dom";
import { CalendarClock, MapPin, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrintQr } from "@/components/asset-posting/print/PrintQr";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { checkinChannelOf, checkinWindowOf } from "@/lib/biddingContracts/checkinWindow";
import type { ContractWithSession } from "@/types/bidding-contract";

interface Props {
  contract: ContractWithSession | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Phiếu dự phiên. Phiên trực tiếp: mã QR = checkin_token, nhân viên quét tại cửa.
 * Phiên trực tuyến: không có QR — người mua tự điểm danh + mã xác nhận.
 * KHÔNG hiện số CCCD: phiếu hay bị chụp màn hình gửi đi.
 */
export function AttendanceTicketDialog({ contract, onOpenChange }: Props) {
  const navigate = useNavigate();
  const session = contract?.auction_sessions ?? null;
  if (!contract || !session) return null;

  const channel = checkinChannelOf(session.auction_format);
  const { opensAt, closesAt } = checkinWindowOf(session);

  return (
    <Dialog open={!!contract} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Phiếu dự phiên</DialogTitle>
          <DialogDescription>
            {session.code && <span className="font-mono">{session.code} · </span>}
            {session.title}
          </DialogDescription>
        </DialogHeader>

        {channel === "onsite" && (
          <div className="mx-auto w-56 rounded-xl border border-border bg-background p-3">
            <PrintQr value={contract.checkin_token} label={`Mã điểm danh hồ sơ ${contract.code}`} />
          </div>
        )}

        <div className="space-y-1 text-center">
          <p className="font-semibold text-foreground">{contract.org_name ?? contract.full_name}</p>
          {contract.org_name && <p className="text-sm text-muted-foreground">Người ĐDPL: {contract.full_name}</p>}
          {contract.has_proxy && (
            <p className="text-sm text-muted-foreground">Người được uỷ quyền: {contract.proxy_full_name}</p>
          )}
          <p className="font-mono text-xs text-muted-foreground">{contract.code}</p>
        </div>

        <dl className="space-y-2 rounded-xl bg-muted p-3 text-sm">
          <div className="flex gap-2">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">Giờ điểm danh</dt>
              <dd className="text-foreground">
                {formatDateTime(opensAt.toISOString())} – {formatDateTime(closesAt.toISOString())}
              </dd>
            </div>
          </div>
          {channel === "onsite" ? (
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Địa điểm</dt>
                <dd className="text-foreground">{session.venue || "Tổ chức đấu giá sẽ thông báo"}</dd>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Hình thức</dt>
                <dd className="text-foreground">Trực tuyến — tự điểm danh trên trang phiên</dd>
              </div>
            </div>
          )}
        </dl>

        <p className="text-xs text-muted-foreground">
          {channel === "onsite"
            ? "Mang theo giấy tờ tuỳ thân bản gốc đã khai trong hồ sơ. Nhân viên quét mã này để điểm danh; số báo danh được cấp ngẫu nhiên khi điểm danh."
            : "Trong giờ điểm danh, bấm “Điểm danh” trên trang phiên và nhập mã xác nhận gửi tới số điện thoại đăng ký. Số báo danh được cấp ngẫu nhiên khi điểm danh."}{" "}
          Không điểm danh trước giờ đóng sẽ bị ghi vắng mặt và không được hoàn trả tiền đặt trước.
        </p>

        {channel === "online" && (
          <Button onClick={() => navigate(`/sessions/${session.id}`)}>Đến trang phiên</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

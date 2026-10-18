import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PrintQr } from "@/components/asset-posting/print/PrintQr";
import { CheckinModal } from "@/components/bidder-checkin/CheckinModal";
import {
  ticketChecklist,
  ticketFileName,
  ticketInfoOf,
  type TicketContract,
  type TicketSession,
} from "@/lib/biddingContracts/attendanceTicket";
import { checkinWindowOf } from "@/lib/biddingContracts/checkinWindow";
import { saveBlob } from "@/lib/pdf/saveBlob";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: TicketContract;
  session: TicketSession;
  /** Số lô đã đăng ký; null/rỗng ⇒ không hiện dòng "Tài sản". */
  lotNos?: number[] | null;
}

/**
 * Phiếu dự phiên ĐẤU GIÁ TRỰC TIẾP (design san-checkin.js `scTicket`): mã QR =
 * checkin_token, nhân viên quét tại bàn điểm danh rồi cấp số báo danh ngẫu nhiên.
 * KHÔNG hiện số CCCD — phiếu hay bị chụp màn hình gửi đi.
 */
export function AttendanceTicketDialog({ open, onOpenChange, contract, session, lotNos }: Props) {
  const [downloading, setDownloading] = useState(false);
  const t = ticketInfoOf(contract, session, lotNos);
  const checklist = ticketChecklist(checkinWindowOf(session).closesAt);

  const download = async () => {
    setDownloading(true);
    try {
      const { ticketPdfBlob } = await import("@/lib/biddingContracts/ticketPdf");
      saveBlob(await ticketPdfBlob(t, checklist), ticketFileName(t.contractCode));
    } catch {
      toast.error("Không tạo được phiếu PDF — vui lòng thử lại.");
    } finally {
      setDownloading(false);
    }
  };

  const rows: [string, React.ReactNode][] = [
    ["Người dự phiên", t.attendee],
    ...(t.registrant ? ([["Người đăng ký", t.registrant]] as [string, React.ReactNode][]) : []),
    ["Mã hồ sơ", <span className="font-mono">{t.contractCode}</span>],
    ...(t.lots ? ([["Tài sản", t.lots]] as [string, React.ReactNode][]) : []),
    ["Điểm danh", t.window],
    ["Địa điểm", t.venue || "Tổ chức đấu giá sẽ thông báo"],
    [
      "Số báo danh",
      t.bidderNo ? <b className="font-mono text-primary">{t.bidderNo}</b> : "Cấp ngẫu nhiên khi điểm danh",
    ],
  ];

  return (
    <CheckinModal
      open={open}
      onOpenChange={onOpenChange}
      title="Phiếu dự phiên"
      sub={`${t.sessionCode ? `${t.sessionCode} · ` : ""}đấu giá trực tiếp`}
    >
      <div className="overflow-hidden rounded-[14px] shadow-[inset_0_0_0_1px_hsl(var(--border))]">
        <div className="flex flex-col items-center gap-2 bg-muted p-4">
          <div className="w-[184px] rounded-[10px] bg-card p-3 shadow-[inset_0_0_0_1px_hsl(var(--border))]">
            <PrintQr value={t.token} label={`Mã điểm danh hồ sơ ${t.contractCode}`} />
          </div>
          <span className="text-xs text-muted-foreground">Đưa mã này cho nhân viên tại bàn điểm danh</span>
        </div>
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3.5 gap-y-2 border-t border-dashed border-border px-4 py-3.5 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ul className="flex flex-col gap-1.5 text-[13px] text-foreground">
        {checklist.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            {line}
          </li>
        ))}
      </ul>

      <Button variant="outline" className="h-10 w-full" disabled={downloading} onClick={download}>
        {downloading && <Loader2 className="h-4 w-4 animate-spin" />}
        Tải phiếu (PDF)
      </Button>
    </CheckinModal>
  );
}

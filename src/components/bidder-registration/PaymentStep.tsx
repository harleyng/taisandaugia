import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KvBox } from "@/components/auction-sessions/detail/ui";
import { CheckRow, TagPill } from "@/components/buyer-contracts/ui";
import { formatVnd } from "@/lib/advertising/slug";
import { StepCard } from "./StepCard";

export interface HeldContract {
  contractId: string;
  code: string;
  holdExpiresAt: string | null;
  fee: number;
}

interface Props {
  held: HeldContract;
  sessionCode: string | null;
  busy: boolean;
  onPay: (expired: boolean) => void;
  onEdit: () => void;
  onCancel: () => void;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Bước 5 — hồ sơ đã tạo + giữ suất 15 phút ⇒ thanh toán phí hồ sơ qua VNPay. */
export function PaymentStep({ held, sessionCode, busy, onPay, onEdit, onCancel }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = held.holdExpiresAt ? Date.parse(held.holdExpiresAt) - now : 0;
  const expired = left <= 0;

  return (
    <StepCard
      title="Thanh toán phí hồ sơ"
      aside={
        <TagPill
          tag={{ label: expired ? "Hết giờ giữ suất" : `Giữ suất ${mmss(left)}`, tone: expired ? "red" : "amber" }}
          className="font-mono"
        />
      }
    >
      <p className="text-sm text-muted-foreground">
        Hồ sơ <b className="font-mono text-foreground">{held.code}</b>{" "}
        {expired
          ? "đã hết giờ giữ suất. Bấm thanh toán để giữ suất mới nếu phiên còn chỗ."
          : "đã được tạo và giữ suất trong 15 phút. Quá thời gian, suất được trả lại."}
      </p>
      <KvBox
        rows={[
          { label: `Phí hồ sơ${sessionCode ? ` · ${sessionCode}` : ""}`, value: formatVnd(held.fee) },
          { label: "Phí giao dịch", value: formatVnd(0) },
          {
            label: <span className="font-semibold text-foreground">Tổng thanh toán</span>,
            value: <b className="text-lg">{formatVnd(held.fee)}</b>,
          },
        ]}
      />
      <CheckRow checked radio aside={<span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-primary">VNPAY</span>}>
        <b className="block text-sm font-semibold">VNPay</b>
        <span className="text-xs text-muted-foreground">QR ngân hàng, thẻ ATM nội địa, thẻ quốc tế, ví VNPay</span>
      </CheckRow>
      <Button className="h-11 w-full gap-1.5 text-[15px] font-semibold" disabled={busy} onClick={() => onPay(expired)}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Thanh toán {formatVnd(held.fee)} qua VNPay
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Bạn được chuyển sang cổng VNPay, thanh toán xong tự quay lại trang này.
      </p>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" disabled={busy} onClick={onEdit}>
          <ArrowLeft className="h-4 w-4" />
          Sửa thông tin
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={busy} onClick={onCancel}>
          Huỷ hồ sơ
        </Button>
      </div>
    </StepCard>
  );
}

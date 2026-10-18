import { useState } from "react";
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
import { InfoBox } from "@/components/shared/InfoBox";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { useLotAuctionConsultSuggestion } from "@/hooks/useAuctionConsultSuggestions";
import { durationChoice } from "@/lib/auctionConsult/suggestion";
import {
  CUSTOM,
  DEFAULT_DURATION_MINUTES,
  durationChoiceValid,
  durationSecondsOf,
  isDurationClamped,
  previewLotEndsAt,
} from "@/lib/bidding/controlAccess";
import { floorPriceError, previewDescendingEndsAt } from "@/lib/bidding/descending";
import { secondsText, type BiddingMethod } from "@/lib/bidding/methods";
import type { AuctionSessionItem } from "@/types/auction-session";
import { DurationPicker } from "./DurationPicker";

/**
 * Chọn CỬA SỔ TRẢ GIÁ khi mở lô.
 *
 * Vì sao phải hỏi: org_open_lot bản đầu đặt ends_at của lô đúng bằng ends_at
 * của phiên. Phiên thường kéo dài nhiều tuần, nên lô mở ra là đồng hồ hiện
 * "còn N ngày", gia hạn mềm không bao giờ chạm tới, và không có lô nào tự đóng.
 *
 * Mốc đóng hiện ở đây được tính bằng previewLotEndsAt — bản TS của đúng biểu
 * thức LEAST trong SQL, nên con số xem trước không thể lệch với thứ server ghi.
 *
 * Theo phương thức (20261018190000):
 *   • đặt giá xuống — KHÔNG hỏi thời lượng: server tự tính từ giá sàn + nhịp giảm
 *     (previewDescendingEndsAt); thiếu/sai giá sàn thì chặn nút;
 *   • bỏ phiếu kín — thời lượng BẮT BUỘC (ẩn "Đến hết phiên").
 */

interface Props {
  lot: AuctionSessionItem | null;
  sessionEndsAt: string;
  extensionSeconds: number;
  method: BiddingMethod;
  dropSeconds: number;
  now: Date;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (durationSeconds: number | null) => void;
}

export function OpenLotDialog({
  lot,
  sessionEndsAt,
  extensionSeconds,
  method,
  dropSeconds,
  now,
  pending,
  onOpenChange,
  onConfirm,
}: Props) {
  const [choice, setChoice] = useState(String(DEFAULT_DURATION_MINUTES));
  const [custom, setCustom] = useState("");
  // Thời lượng từ đề xuất tư vấn đã được chủ tài sản chấp nhận — chỉ gợi ý, mặc định giữ nguyên.
  const suggestion = useLotAuctionConsultSuggestion(lot?.session_id, lot?.asset_posting_id, !!lot);
  const suggested = durationChoice(suggestion?.lot_duration_minutes, CUSTOM);
  const suggestedApplied = !!suggested && choice === suggested.choice && (suggested.custom ?? custom) === custom;

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setChoice(String(DEFAULT_DURATION_MINUTES));
      setCustom("");
    }
    onOpenChange(nextOpen);
  };

  const descending = method === "descending";
  const floorError = descending && lot ? floorPriceError(lot.starting_price, lot.bid_step, lot.floor_price) : null;
  const descPreview = descending && lot ? previewDescendingEndsAt(now, lot, dropSeconds, sessionEndsAt) : null;

  // Đặt giá xuống: server bỏ qua thời lượng ⇒ gửi null.
  const durationSeconds = descending ? null : durationSecondsOf(choice, custom);
  const valid = descending ? !floorError && !!descPreview : durationChoiceValid(choice, custom);
  const endsAt = descPreview?.endsAt ?? previewLotEndsAt(now, durationSeconds, sessionEndsAt);
  const clamped = descPreview ? descPreview.clamped : isDurationClamped(now, durationSeconds, sessionEndsAt);

  return (
    <Dialog open={!!lot} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mở tài sản {lot?.lot_no} để trả giá?</DialogTitle>
          <DialogDescription>
            {lot?.title} — giá khởi điểm {formatVnd(lot?.starting_price)}, bước giá {formatVnd(lot?.bid_step)}. Người
            đủ điều kiện sẽ trả giá được ngay khi tài sản mở.
          </DialogDescription>
        </DialogHeader>

        {descending ? (
          <div className="space-y-1 rounded-xl border p-3 text-sm">
            <p>
              Đặt giá xuống: giảm {formatVnd(lot?.bid_step)} mỗi {secondsText(dropSeconds)}, từ{" "}
              {formatVnd(lot?.starting_price)} xuống giá sàn <strong>{formatVnd(lot?.floor_price)}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Thời lượng tự tính theo giá sàn — người đầu tiên chấp nhận giá trúng và tài sản đóng ngay.
            </p>
            {floorError && <p className="text-xs font-medium text-destructive">{floorError}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <Label>{method === "sealed" ? "Thời gian nhận phiếu" : "Thời lượng trả giá"}</Label>
            {suggestion && suggested && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                <span className="text-foreground">
                  Đề xuất tư vấn v{suggestion.version}: <strong>{suggestion.lot_duration_minutes} phút</strong>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={suggestedApplied ? "ghost" : "outline"}
                  className="h-7 px-2.5 text-xs"
                  disabled={suggestedApplied}
                  onClick={() => {
                    setChoice(suggested.choice);
                    if (suggested.custom) setCustom(suggested.custom);
                  }}
                >
                  {suggestedApplied ? "Đang dùng" : "Áp dụng"}
                </Button>
              </div>
            )}
            <DurationPicker
              idPrefix="dur"
              choice={choice}
              custom={custom}
              onChoice={setChoice}
              onCustom={setCustom}
              allowUntilEnd={method !== "sealed"}
            />
          </div>
        )}

        <div className="space-y-1 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          <p>
            Tài sản sẽ đóng lúc <strong className="text-foreground">{formatDateTime(endsAt)}</strong>
          </p>
          <p>Phiên kết thúc lúc {formatDateTime(sessionEndsAt)}</p>
          {method === "ascending" && extensionSeconds > 0 && (
            // Người điều hành hay hiểu "15 phút" là đóng đúng sau 15 phút.
            <p>
              Mỗi lượt trả giá trong {Math.round(extensionSeconds / 60)} phút cuối sẽ tự gia hạn thêm{" "}
              {Math.round(extensionSeconds / 60)} phút.
            </p>
          )}
        </div>

        {clamped && (
          <InfoBox variant="amber" className="text-sm">
            {descending
              ? "Phiên kết thúc trước khi giá chạm sàn — tài sản đóng cùng lúc phiên kết thúc."
              : "Thời lượng đã chọn dài hơn thời gian còn lại của phiên — tài sản sẽ đóng cùng lúc phiên kết thúc."}
          </InfoBox>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={pending}>
            Huỷ
          </Button>
          <Button onClick={() => onConfirm(durationSeconds)} disabled={!valid || pending} className="gap-1.5">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Mở tài sản
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { NumberInput } from "@/components/ui/number-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InfoBox } from "@/components/shared/InfoBox";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import {
  DEFAULT_DURATION_MINUTES,
  DURATION_PRESETS,
  isDurationClamped,
  isValidDurationMinutes,
  minutesToSeconds,
  previewLotEndsAt,
} from "@/lib/bidding/controlAccess";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Chọn CỬA SỔ TRẢ GIÁ khi mở lô.
 *
 * Vì sao phải hỏi: org_open_lot bản đầu đặt ends_at của lô đúng bằng ends_at
 * của phiên. Phiên thường kéo dài nhiều tuần, nên lô mở ra là đồng hồ hiện
 * "còn N ngày", gia hạn mềm không bao giờ chạm tới, và không có lô nào tự đóng.
 *
 * Mốc đóng hiện ở đây được tính bằng previewLotEndsAt — bản TS của đúng biểu
 * thức LEAST trong SQL, nên con số xem trước không thể lệch với thứ server ghi.
 */

const UNTIL_END = "until_end";
const CUSTOM = "custom";

interface Props {
  lot: AuctionSessionItem | null;
  sessionEndsAt: string;
  extensionSeconds: number;
  now: Date;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (durationSeconds: number | null) => void;
}

export function OpenLotDialog({
  lot,
  sessionEndsAt,
  extensionSeconds,
  now,
  pending,
  onOpenChange,
  onConfirm,
}: Props) {
  const [choice, setChoice] = useState(String(DEFAULT_DURATION_MINUTES));
  const [custom, setCustom] = useState("");

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setChoice(String(DEFAULT_DURATION_MINUTES));
      setCustom("");
    }
    onOpenChange(nextOpen);
  };

  const customMinutes = Number(custom);
  const customValid = custom !== "" && isValidDurationMinutes(customMinutes);

  const durationSeconds =
    choice === UNTIL_END
      ? null
      : choice === CUSTOM
        ? customValid
          ? minutesToSeconds(customMinutes)
          : null
        : minutesToSeconds(Number(choice));

  // Chỉ "Tuỳ chọn" mới chặn được nút: các mốc bấm nhanh luôn hợp lệ.
  const valid = choice !== CUSTOM || customValid;
  const endsAt = previewLotEndsAt(now, durationSeconds, sessionEndsAt);
  const clamped = isDurationClamped(now, durationSeconds, sessionEndsAt);

  return (
    <Dialog open={!!lot} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mở lô {lot?.lot_no} để trả giá?</DialogTitle>
          <DialogDescription>
            {lot?.title} — giá khởi điểm {formatVnd(lot?.starting_price)}, bước giá {formatVnd(lot?.bid_step)}. Người
            đủ điều kiện sẽ trả giá được ngay khi lô mở.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Thời lượng trả giá</Label>
          <RadioGroup value={choice} onValueChange={setChoice} className="gap-2">
            {DURATION_PRESETS.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <RadioGroupItem value={String(m)} id={`dur-${m}`} />
                <Label htmlFor={`dur-${m}`} className="font-normal">
                  {m} phút
                </Label>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <RadioGroupItem value={CUSTOM} id="dur-custom" />
              <Label htmlFor="dur-custom" className="font-normal">
                Tuỳ chọn
              </Label>
              <NumberInput
                value={custom}
                onChange={setCustom}
                allowDecimal={false}
                placeholder="phút"
                className="h-8 w-24"
                onFocus={() => setChoice(CUSTOM)}
              />
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value={UNTIL_END} id="dur-end" />
              <Label htmlFor="dur-end" className="font-normal">
                Đến hết phiên
              </Label>
            </div>
          </RadioGroup>
          {choice === CUSTOM && custom !== "" && !customValid && (
            <p className="text-xs text-destructive">Nhập số phút nguyên từ 1 đến 1.440 (24 giờ).</p>
          )}
        </div>

        <div className="space-y-1 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          <p>
            Lô sẽ đóng lúc <strong className="text-foreground">{formatDateTime(endsAt)}</strong>
          </p>
          <p>Phiên kết thúc lúc {formatDateTime(sessionEndsAt)}</p>
          {extensionSeconds > 0 && (
            // Người điều hành hay hiểu "15 phút" là đóng đúng sau 15 phút.
            <p>
              Mỗi lượt trả giá trong {Math.round(extensionSeconds / 60)} phút cuối sẽ tự gia hạn thêm{" "}
              {Math.round(extensionSeconds / 60)} phút.
            </p>
          )}
        </div>

        {clamped && (
          <InfoBox variant="amber" className="text-sm">
            Thời lượng đã chọn dài hơn thời gian còn lại của phiên — lô sẽ đóng cùng lúc phiên kết thúc.
          </InfoBox>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={pending}>
            Huỷ
          </Button>
          <Button onClick={() => onConfirm(durationSeconds)} disabled={!valid || pending} className="gap-1.5">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Mở lô
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

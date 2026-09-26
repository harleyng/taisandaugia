import { useEffect, useId, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SHARE_DAYS,
  SHARE_DURATIONS,
  SHARE_DURATION_LABEL,
  formatShareDay,
  type ShareDuration,
} from "@/lib/ownerReportShare";

interface ShareReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "create" = link mới (chưa có / đã hết hạn); "extend" = dời hạn link đang dùng. */
  mode: "create" | "extend";
  busy: boolean;
  onConfirm: (days: ShareDuration) => void;
}

const isDuration = (v: string): v is `${ShareDuration}` => SHARE_DURATIONS.some((d) => String(d) === v);

/** Chọn thời hạn link chia sẻ (7 / 30 / 90 ngày, tính từ hôm nay). */
export function ShareReportDialog({ open, onOpenChange, mode, busy, onConfirm }: ShareReportDialogProps) {
  const idPrefix = useId();
  const [days, setDays] = useState<ShareDuration>(DEFAULT_SHARE_DAYS);
  useEffect(() => {
    if (open) setDays(DEFAULT_SHARE_DAYS);
  }, [open]);

  const expiryOf = (d: ShareDuration) => formatShareDay(new Date(Date.now() + d * 86_400_000).toISOString());
  const extend = mode === "extend";

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{extend ? "Gia hạn link chia sẻ" : "Tạo link chia sẻ"}</DialogTitle>
          <DialogDescription>
            {extend
              ? "Link đã gửi vẫn giữ nguyên — chỉ đổi hạn dùng, tính từ hôm nay."
              : "Người nhận mở được báo cáo mà không cần đăng nhập, chỉ xem, không sửa được. Bạn thu hồi được link bất cứ lúc nào."}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-foreground">Thời hạn</legend>
          <RadioGroup
            value={String(days)}
            onValueChange={(v) => {
              // Radix có thể bắn "" khi danh sách lựa chọn đổi — bỏ qua giá trị lạ.
              if (isDuration(v)) setDays(Number(v) as ShareDuration);
            }}
            className="gap-2"
          >
            {SHARE_DURATIONS.map((d) => (
              <Label
                key={d}
                htmlFor={`${idPrefix}-${d}`}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal transition-colors",
                  days === d ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                )}
              >
                <RadioGroupItem id={`${idPrefix}-${d}`} value={String(d)} disabled={busy} />
                <span className="flex-1 text-sm font-medium text-foreground">{SHARE_DURATION_LABEL[d]}</span>
                <span className="text-xs tabular-nums text-muted-foreground">hết hạn {expiryOf(d)}</span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button type="button" disabled={busy} onClick={() => onConfirm(days)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {extend ? "Gia hạn" : "Tạo link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

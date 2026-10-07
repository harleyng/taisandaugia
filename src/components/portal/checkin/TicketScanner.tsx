import { useEffect, useRef, useState } from "react";
import { CameraOff, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nội dung mã QR đọc được (checkin_token) — dialog tự đóng sau lần đọc đầu. */
  onDetected: (text: string) => void;
}

type ScanState = "starting" | "scanning" | "error";

/**
 * Quét mã QR trên phiếu dự phiên bằng camera (ưu tiên camera sau).
 * @zxing/browser nạp lười — chỉ máy ở cửa điểm danh mới tải thư viện.
 */
export function TicketScanner({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>("starting");
  const [errorText, setErrorText] = useState("");
  // Giữ callback mới nhất mà không phải khởi động lại camera mỗi lần render.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stop: (() => void) | null = null;
    setState("starting");

    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        // Dialog dựng video trong portal — chờ một nhịp cho ref gắn.
        await new Promise((r) => requestAnimationFrame(r));
        if (stopped || !videoRef.current) return;
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result, _err, ctl) => {
            if (!result || stopped) return;
            stopped = true;
            ctl.stop();
            onDetectedRef.current(result.getText());
          },
        );
        stop = () => controls.stop();
        if (stopped) stop();
        else setState("scanning");
      } catch (err) {
        if (stopped) return;
        const name = (err as { name?: string })?.name;
        setErrorText(
          name === "NotAllowedError"
            ? "Trình duyệt chưa được cấp quyền dùng camera. Cho phép camera rồi mở lại, hoặc tìm theo tên / số giấy tờ."
            : name === "NotFoundError"
              ? "Không tìm thấy camera trên thiết bị này. Hãy tìm theo tên / số giấy tờ / mã hồ sơ."
              : "Không mở được camera. Hãy tìm theo tên / số giấy tờ / mã hồ sơ.",
        );
        setState("error");
      }
    })();

    return () => {
      stopped = true;
      stop?.();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quét phiếu dự phiên</DialogTitle>
          <DialogDescription>Đưa mã QR trên phiếu của người tham gia vào giữa khung hình.</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-square overflow-hidden rounded-xl bg-foreground">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {state === "scanning" && (
            <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-primary-foreground/80" />
          )}
          {state === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-primary-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang mở camera…
            </div>
          )}
          {state === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted p-6 text-center">
              <CameraOff className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{errorText}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

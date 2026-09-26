import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatReportDay } from "@/lib/ownerPeriodicReport";

interface FinalizeReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Ngày cuối kỳ khi kỳ CHƯA kết thúc (cảnh báo số liệu còn thiếu); null khi kỳ đã hết. */
  periodEndsOn: string | null;
  /** Ghi chú đang sửa chưa lưu — sẽ được lưu trước khi chốt. */
  hasUnsavedNotes: boolean;
  busy: boolean;
  onConfirm: () => void;
}

/** Xác nhận "Chốt báo cáo": sau bước này số liệu đóng băng và báo cáo không xoá được. */
export function FinalizeReportDialog({
  open,
  onOpenChange,
  title,
  periodEndsOn,
  hasUnsavedNotes,
  busy,
  onConfirm,
}: FinalizeReportDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Chốt {title.charAt(0).toLowerCase() + title.slice(1)}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Sau khi chốt, số liệu được đóng băng và báo cáo không xoá được — sửa kết quả phiên sau đó không làm
                đổi báo cáo này. Muốn đính chính thì lập báo cáo mới cho cùng kỳ.
              </p>
              {periodEndsOn && (
                <p className="font-medium text-foreground">
                  Kỳ này chưa kết thúc (hết ngày {formatReportDay(periodEndsOn)}) — các phiên sau hôm nay sẽ không có
                  trong báo cáo.
                </p>
              )}
              {hasUnsavedNotes && <p>Ghi chú đang sửa sẽ được lưu trước khi chốt.</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Để sau</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Chốt báo cáo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

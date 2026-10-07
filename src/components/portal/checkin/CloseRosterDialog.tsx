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
import { useCloseRosterNow } from "@/hooks/useSessionCheckin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  /** Số người đủ điều kiện mà chưa điểm danh — sẽ bị ghi vắng. */
  awaiting: number;
}

/**
 * Đấu giá viên chốt danh sách trước khi hết thời gian ân hạn. Không hoàn tác:
 * ai chưa điểm danh thành vắng mặt và tiền đặt trước chuyển sang "Không hoàn trả"
 * (sổ tiền đặt trước tự ghi sự kiện qua trigger).
 */
export function CloseRosterDialog({ open, onOpenChange, sessionId, awaiting }: Props) {
  const close = useCloseRosterNow();

  return (
    <AlertDialog open={open} onOpenChange={(o) => !close.isPending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Chốt danh sách điểm danh ngay?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {awaiting > 0 ? (
                <p>
                  <strong className="text-foreground">{awaiting} người</strong> đủ điều kiện nhưng chưa điểm danh sẽ bị
                  ghi <strong className="text-foreground">vắng mặt</strong> và{" "}
                  <strong className="text-foreground">không được hoàn trả tiền đặt trước</strong>.
                </p>
              ) : (
                <p>Mọi người đủ điều kiện đều đã điểm danh — không ai bị ghi vắng.</p>
              )}
              <p>
                Sau khi chốt, không ai điểm danh thêm được và không đổi được thời gian điểm danh. Trường hợp vắng có lý
                do chính đáng có thể miễn trừ sau ở danh sách điểm danh.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={close.isPending}>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            disabled={close.isPending}
            className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              close.mutate(sessionId, { onSuccess: () => onOpenChange(false) });
            }}
          >
            {close.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Chốt danh sách
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

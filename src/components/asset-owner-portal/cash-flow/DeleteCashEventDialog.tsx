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
import { buttonVariants } from "@/components/ui/button";
import { useDeleteCashEvent } from "@/hooks/useOwnerCashFlow";
import { CASH_KIND_LABEL } from "@/lib/ownerCashEvent";
import type { CashEvent } from "@/lib/ownerCashFlow";
import { formatDayFull } from "@/lib/ownerPulse";
import { formatMoneyFull } from "@/utils/money";

interface DeleteCashEventDialogProps {
  workspaceId: string;
  event: CashEvent | null;
  onClose: () => void;
}

/** Xác nhận xoá một khoản — số đã thu của tài sản được tính lại ngay. */
export function DeleteCashEventDialog({ workspaceId, event, onClose }: DeleteCashEventDialogProps) {
  const del = useDeleteCashEvent(workspaceId);
  return (
    <AlertDialog open={!!event} onOpenChange={(v) => !v && !del.isPending && onClose()}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá khoản này?</AlertDialogTitle>
          <AlertDialogDescription>
            {event && (
              <>
                {CASH_KIND_LABEL[event.kind]} {formatMoneyFull(event.amount)} ngày {formatDayFull(event.occurredOn)} của «
                {event.title}». Số đã thu và trạng thái thu tiền của tài sản sẽ được tính lại.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={del.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (event) del.mutate({ id: event.id }, { onSuccess: onClose });
            }}
          >
            Xoá khoản
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

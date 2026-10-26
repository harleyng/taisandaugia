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
import { useDeletePlanItem } from "@/hooks/useAuctionPlan";
import type { AuctionPlan, AuctionPlanItem } from "@/lib/auctionPlan/types";

/** Xoá một tài sản khỏi kế hoạch — chỉ được khi kế hoạch ở nháp / đang điều chỉnh. */
export function DeletePlanItemDialog({
  item,
  plan,
  onOpenChange,
}: {
  item: AuctionPlanItem | null;
  plan: AuctionPlan;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteM = useDeletePlanItem(plan);

  return (
    <AlertDialog open={!!item} onOpenChange={(v) => !deleteM.isPending && onOpenChange(v)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá tài sản khỏi kế hoạch?</AlertDialogTitle>
          <AlertDialogDescription>
            «{item?.title}» ({item?.item_code}) sẽ bị xoá cùng các mốc công việc của nó. Các tài sản sau không được
            cấp lại số, nên mã của chúng giữ nguyên.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteM.isPending}>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteM.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (item) deleteM.mutate(item.id, { onSuccess: () => onOpenChange(false) });
            }}
          >
            Xoá tài sản
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

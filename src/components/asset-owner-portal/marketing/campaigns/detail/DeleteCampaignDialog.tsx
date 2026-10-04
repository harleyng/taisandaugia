import { useNavigate } from "react-router-dom";
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
import { useDeleteCampaign } from "@/hooks/useOwnerMarketingCampaigns";
import { OWNER_CAMPAIGNS_HREF } from "@/lib/ownerMarketing/routes";

interface DeleteCampaignDialogProps {
  campaign: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}

/** Xoá bản nháp CHƯA TỪNG gửi duyệt (server chặn mọi trường hợp khác). */
export function DeleteCampaignDialog({ campaign, onOpenChange }: DeleteCampaignDialogProps) {
  const navigate = useNavigate();
  const del = useDeleteCampaign();
  return (
    <AlertDialog open={!!campaign} onOpenChange={(v) => !del.isPending && onOpenChange(v)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá bản nháp “{campaign?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>Bản nháp chưa gửi duyệt nên chưa có link Hồ sơ online nào. Không hoàn tác được.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Giữ lại</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={del.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (!campaign) return;
              del.mutate(campaign.id, {
                onSuccess: () => {
                  onOpenChange(false);
                  navigate(OWNER_CAMPAIGNS_HREF);
                },
              });
            }}
          >
            Xoá
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

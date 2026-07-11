import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Eye, Pencil, Copy, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { useDeleteCampaign, useEndCampaign } from "@/hooks/useCampaigns";
import { isEditable } from "@/lib/marketing/campaignStatus";
import type { Campaign } from "@/types/marketing";

type ConfirmType = "copy" | "cancel" | "delete";

interface Props {
  campaign: Campaign;
  /** "menu" = dropdown cho dòng danh sách; "buttons" = nút inline cho header chi tiết. */
  layout: "menu" | "buttons";
  /** Chạy sau khi xóa thành công (vd. màn chi tiết điều hướng về danh sách). */
  afterDelete?: () => void;
}

/**
 * Bộ action dùng chung cho chiến dịch — nguồn chân lý duy nhất cho điều kiện hiển thị
 * + popup xác nhận, để danh sách và màn chi tiết không bao giờ lệch nhau.
 */
export function CampaignActions({ campaign, layout, afterDelete }: Props) {
  const navigate = useNavigate();
  const deleteCampaign = useDeleteCampaign();
  const endCampaign = useEndCampaign();
  const [confirm, setConfirm] = useState<ConfirmType | null>(null);

  const canEdit = isEditable(campaign.status); // draft
  const canCancel = campaign.status === "scheduled";
  const canDelete = campaign.status === "draft";
  const busy = deleteCampaign.isPending || endCampaign.isPending;

  const goDetail = () => navigate(`/admin/marketing/email/${campaign.id}`);
  const goEdit = () => navigate(`/admin/marketing/email/${campaign.id}/edit`);

  const doCopy = () => {
    setConfirm(null);
    // Không clone vào DB — mở màn tạo với dữ liệu điền sẵn từ chiến dịch nguồn.
    navigate(`/admin/marketing/email/new?from=${campaign.id}`);
  };

  const doCancel = async () => {
    setConfirm(null);
    try {
      await endCampaign.mutateAsync(campaign.id);
      toast.success("Đã huỷ chiến dịch");
    } catch {
      toast.error("Thao tác thất bại");
    }
  };

  const doDelete = async () => {
    setConfirm(null);
    try {
      await deleteCampaign.mutateAsync(campaign.id);
      toast.success("Đã xóa chiến dịch");
      afterDelete?.();
    } catch {
      toast.error("Xóa thất bại");
    }
  };

  return (
    <>
      {layout === "menu" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Thao tác</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={goDetail} className="gap-2">
              <Eye className="h-3.5 w-3.5" /> Xem chi tiết
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={goEdit} className="gap-2">
                <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setConfirm("copy")} className="gap-2">
              <Copy className="h-3.5 w-3.5" /> Sao chép
            </DropdownMenuItem>
            {canCancel && (
              <DropdownMenuItem
                onClick={() => setConfirm("cancel")}
                className="gap-2 text-destructive"
              >
                <Ban className="h-3.5 w-3.5" /> Huỷ lịch gửi
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                onClick={() => setConfirm("delete")}
                className="gap-2 text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Xóa
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={goEdit}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Chỉnh sửa
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setConfirm("copy")}>
            <Copy className="h-4 w-4 mr-1.5" />
            Sao chép
          </Button>
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={busy}
              onClick={() => setConfirm("cancel")}
            >
              <Ban className="h-4 w-4 mr-1.5" />
              Huỷ lịch gửi
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={busy}
              onClick={() => setConfirm("delete")}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Xóa
            </Button>
          )}
        </div>
      )}

      {/* Xác nhận: Sao chép */}
      <AlertDialog open={confirm === "copy"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sao chép chiến dịch?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sẽ được đưa tới màn tạo chiến dịch mới với thông tin của &quot;{campaign.name}&quot;
              được điền sẵn. Chiến dịch mới chỉ được tạo khi bạn bấm lưu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={doCopy}>Sao chép</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Xác nhận: Huỷ lịch gửi */}
      <AlertDialog open={confirm === "cancel"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Huỷ lịch gửi?</AlertDialogTitle>
            <AlertDialogDescription>
              Chiến dịch &quot;{campaign.name}&quot; sẽ chuyển sang trạng thái Đã huỷ và không được
              gửi theo lịch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={doCancel}
            >
              Huỷ lịch gửi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Xác nhận: Xóa */}
      <AlertDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa chiến dịch?</AlertDialogTitle>
            <AlertDialogDescription>
              Chiến dịch &quot;{campaign.name}&quot; và danh sách người nhận đã lưu sẽ bị xóa vĩnh
              viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={doDelete}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

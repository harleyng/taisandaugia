import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Eye, Pencil, Copy, Pause, Play, Square, Trash2 } from "lucide-react";
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
import {
  useDeleteAdvertisement,
  useUpdateAdStatus,
  isUniquePositionError,
} from "@/hooks/useAdvertisements";
import { isEditable } from "@/lib/advertising/adStatus";
import type { Advertisement } from "@/types/advertising";

type ConfirmType = "copy" | "end" | "delete";

interface Props {
  ad: Advertisement;
  layout: "menu" | "buttons";
  afterDelete?: () => void;
}

export function AdActions({ ad, layout, afterDelete }: Props) {
  const navigate = useNavigate();
  const del = useDeleteAdvertisement();
  const setStatus = useUpdateAdStatus();
  const [confirm, setConfirm] = useState<ConfirmType | null>(null);

  const canEdit = isEditable(ad.status); // draft || scheduled
  const canPause = ad.status === "active";
  const canResume = ad.status === "paused";
  const canEnd = ad.status === "scheduled" || ad.status === "active" || ad.status === "paused";
  const canDelete = ad.status === "draft";
  const busy = del.isPending || setStatus.isPending;

  const goDetail = () => navigate(`/admin/marketing/quang-cao/${ad.id}`);
  const goEdit = () => navigate(`/admin/marketing/quang-cao/${ad.id}/edit`);

  const changeStatus = async (status: Advertisement["status"], okMsg: string) => {
    try {
      await setStatus.mutateAsync({ id: ad.id, status });
      toast.success(okMsg);
    } catch (e) {
      toast.error(isUniquePositionError(e) ? (e as Error).message : "Thao tác thất bại");
    }
  };

  const doCopy = () => {
    setConfirm(null);
    navigate(`/admin/marketing/quang-cao/new?from=${ad.id}`);
  };
  const doEnd = async () => {
    setConfirm(null);
    await changeStatus("ended", "Đã kết thúc chiến dịch");
  };
  const doDelete = async () => {
    setConfirm(null);
    try {
      await del.mutateAsync(ad.id);
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
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 hover:text-foreground">
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
            {canPause && (
              <DropdownMenuItem onClick={() => changeStatus("paused", "Đã tạm dừng chiến dịch")} className="gap-2">
                <Pause className="h-3.5 w-3.5" /> Tạm dừng
              </DropdownMenuItem>
            )}
            {canResume && (
              <DropdownMenuItem onClick={() => changeStatus("active", "Đã tiếp tục chiến dịch")} className="gap-2">
                <Play className="h-3.5 w-3.5" /> Tiếp tục
              </DropdownMenuItem>
            )}
            {canEnd && (
              <DropdownMenuItem onClick={() => setConfirm("end")} className="gap-2 text-destructive">
                <Square className="h-3.5 w-3.5" /> Kết thúc
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem onClick={() => setConfirm("delete")} className="gap-2 text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Xóa
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirm("copy")}>
            <Copy className="h-4 w-4 mr-1.5" /> Sao chép
          </Button>
          {canEnd && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirm("end")}>
              <Square className="h-4 w-4 mr-1.5" /> Kết thúc
            </Button>
          )}
          {canPause && (
            <Button variant="outline" size="sm" className="text-destructive" disabled={busy} onClick={() => changeStatus("paused", "Đã tạm dừng chiến dịch")}>
              <Pause className="h-4 w-4 mr-1.5" /> Tạm dừng
            </Button>
          )}
          {canResume && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => changeStatus("active", "Đã tiếp tục chiến dịch")}>
              <Play className="h-4 w-4 mr-1.5" /> Tiếp tục
            </Button>
          )}
          {canEdit && (
            <Button size="sm" disabled={busy} onClick={goEdit}>
              <Pencil className="h-4 w-4 mr-1.5" /> Chỉnh sửa
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={confirm === "copy"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sao chép chiến dịch?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sẽ được đưa tới màn tạo chiến dịch mới với thông tin của &quot;{ad.name}&quot; điền sẵn. Chiến dịch mới chỉ tạo khi bạn bấm lưu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={doCopy}>Sao chép</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "end"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kết thúc chiến dịch?</AlertDialogTitle>
            <AlertDialogDescription>
              Chiến dịch &quot;{ad.name}&quot; sẽ chuyển sang trạng thái Kết thúc và ngừng hiển thị.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={doEnd}>Kết thúc</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa chiến dịch?</AlertDialogTitle>
            <AlertDialogDescription>
              Chiến dịch &quot;{ad.name}&quot; sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={doDelete}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

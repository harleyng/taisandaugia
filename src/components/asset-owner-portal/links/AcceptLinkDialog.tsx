import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { useRespondOwnerLink, type OwnerLinkIncoming } from "@/hooks/useOwnerWorkspaceLinks";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";

interface Props {
  /** null ⇒ đóng. */
  request: OwnerLinkIncoming | null;
  onClose: () => void;
  workspaceId: string;
}

/** Nói rõ trụ sở sẽ thấy gì TRƯỚC khi chi nhánh đồng ý (quyền đọc mở ngay khi bấm). */
export function AcceptLinkDialog({ request, onClose, workspaceId }: Props) {
  const respond = useRespondOwnerLink(workspaceId);

  const confirm = async () => {
    if (!request) return;
    try {
      await respond.mutateAsync({ requestId: request.request_id, accept: true });
      toast.success(`Đã liên kết với ${request.workspace_name}`);
      onClose();
    } catch (err) {
      toast.error("Chưa liên kết được", { description: ownerWsErrorMessage(err) });
    }
  };

  return (
    <AlertDialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Đồng ý liên kết với {request?.workspace_name}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Trưởng đơn vị của trụ sở sẽ xem được tài sản, kết quả phiên, chỉ tiêu, báo cáo định kỳ, hồ sơ số
                hoá và hợp đồng của Trạm này.
              </p>
              <p>Họ không sửa được gì và không thấy danh sách thành viên. Bạn huỷ liên kết được bất cứ lúc nào.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={respond.isPending}>Để sau</AlertDialogCancel>
          <AlertDialogAction
            disabled={respond.isPending}
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {respond.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Đồng ý liên kết
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

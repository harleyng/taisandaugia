import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ContractFileButton } from "./ContractFileButton";

interface ConfirmSignedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  signedDocPath: string | null;
  signedDate: string | null;
  onConfirm: () => void;
}

/**
 * Xác nhận bản đã ký. Tệp hiển thị ở đây chính là tệp gửi lên server để so
 * khớp — bị thay giữa chừng thì server trả document_changed.
 */
export function ConfirmSignedDialog({
  open,
  onOpenChange,
  isPending,
  signedDocPath,
  signedDate,
  onConfirm,
}: ConfirmSignedDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận bản hợp đồng đã ký?</AlertDialogTitle>
          <AlertDialogDescription>
            Mở tệp và kiểm tra lại trước khi xác nhận. Khi cả hai bên xác nhận, hợp đồng có hiệu lực trên sàn và
            không huỷ được tại đây nữa.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <span className="text-muted-foreground">
            {signedDate ? `Ngày ký ${format(new Date(signedDate), "dd/MM/yyyy")}` : "Bản đã ký"}
          </span>
          {signedDocPath && <ContractFileButton path={signedDocPath} label="Mở bản đã ký" />}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Để sau</AlertDialogCancel>
          <Button onClick={onConfirm} disabled={isPending || !signedDocPath} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

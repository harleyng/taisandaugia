import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContractFileButton } from "@/components/consignment/ContractFileButton";
import { SALE_BUCKET } from "@/lib/saleContracts/files";
import { SALE_SIDE_LABELS, type SaleSide } from "@/types/auction-sale-contract";

/**
 * Xác nhận bản đã ký. Nhúng luôn nút mở CHÍNH tệp sắp xác nhận — người xác
 * nhận phải nhìn thấy đúng tệp đó, và server so lại đường dẫn (`document_changed`).
 */
export function ConfirmSignedDialog({
  open, onOpenChange, side, signedDocPath, isPending, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  side: SaleSide;
  signedDocPath: string | null;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận bản hợp đồng đã ký</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn xác nhận với tư cách <strong>{SALE_SIDE_LABELS[side].toLowerCase()}</strong> rằng bản
            scan dưới đây là hợp đồng đã ký. Hãy mở tệp và đọc lại trước khi xác nhận.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {signedDocPath ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <ContractFileButton path={signedDocPath} bucket={SALE_BUCKET} label="Mở bản đã ký" />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Để sau</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending || !signedDocPath}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Xác nhận
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

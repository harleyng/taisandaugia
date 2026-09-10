import { useState } from "react";
import { CalendarDays, FileText, Pencil, Trash2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { contractErrorMessage, useDeleteContract } from "@/hooks/useSupplierContracts";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { ContractLinesEditor } from "./ContractLinesEditor";
import type { SupplierContract } from "@/types/supplierContract";

const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("vi-VN") : "—";

interface Props {
  contract: SupplierContract;
  supplierId: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (c: SupplierContract) => void;
}

export function ContractCard({ contract, supplierId, canEdit, canDelete, onEdit }: Props) {
  const del = useDeleteContract();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remove = async () => {
    try {
      await del.mutateAsync({ id: contract.id, supplierId });
      toast.success("Đã xoá hợp đồng");
    } catch (err) {
      toast.error(contractErrorMessage(err, "Xoá thất bại"));
    }
    setConfirmOpen(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <ContractStatusBadge contract={contract} />
            {contract.code && (
              <span className="text-xs font-mono text-muted-foreground">#{contract.code}</span>
            )}
          </div>
          <h3 className="text-base font-semibold text-foreground truncate">
            {contract.title || `Hợp đồng ${contract.contract_no}`}
          </h3>
          <p className="text-sm text-muted-foreground">Số {contract.contract_no}</p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <Button size="sm" variant="outline" className="h-8" onClick={() => onEdit(contract)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Sửa
            </Button>
            {canDelete && (
              <Button
                size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Ngày ký</p>
          <p className="flex items-center gap-1.5 text-foreground">
            <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
            {fmtDate(contract.signed_date)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Hiệu lực</p>
          <p className="flex items-center gap-1.5 text-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            {fmtDate(contract.effective_from)} –{" "}
            {contract.effective_to ? fmtDate(contract.effective_to) : "vô thời hạn"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Người ký</p>
          <p className="text-foreground truncate">
            {contract.signer_name ?? "—"}
            {contract.signer_title && (
              <span className="text-muted-foreground"> · {contract.signer_title}</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Bản scan</p>
          <p className="flex items-center gap-1.5 text-foreground">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            {contract.doc_path ? "Đã có" : "Chưa có"}
          </p>
        </div>
      </div>

      {contract.note && (
        <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">
          {contract.note}
        </p>
      )}

      <ContractLinesEditor contract={contract} supplierId={supplierId} canEdit={canEdit} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa hợp đồng?</AlertDialogTitle>
            <AlertDialogDescription>
              Hợp đồng số {contract.contract_no} và toàn bộ dòng dịch vụ của nó sẽ bị xoá. Đơn
              hàng đã chốt theo hợp đồng này vẫn giữ nguyên điều khoản đã lưu, chỉ mất đường
              dẫn truy vết. Nếu chỉ muốn ngừng áp dụng, hãy chuyển trạng thái sang
              &quot;Đã chấm dứt&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={remove}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

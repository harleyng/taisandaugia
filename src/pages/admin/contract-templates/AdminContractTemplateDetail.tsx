import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Copy, FileDown, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ContractClausesView } from "@/components/contracts/ContractClausesView";
import { TemplateStatusBadge } from "@/components/admin/contract-templates/TemplateVersionsTable";
import { useContractTemplate, useContractTemplates, useDeleteContractTemplate } from "@/hooks/useContractTemplates";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { legalVersionStatus, vnTodayStr } from "@/lib/legalStatus";
import { formatDate } from "@/lib/dateUtils";
import { templateTypeDef } from "@/lib/contracts/templates/schema";
import { placeholderSlots } from "@/lib/contracts/templates/resolve";
import { templateSampleFileName, templateSamplePdfBlob } from "@/lib/contracts/templates/samplePdf";
import { saveBlob } from "@/lib/pdf/saveBlob";
import { ADMIN_CONTRACT_TEMPLATES_PATH, adminContractTemplateCreatePath } from "@/lib/contracts/paths";

/** /admin/mau-hop-dong/:id — một phiên bản mẫu (chỉ đọc) + PDF xem thử bằng dữ liệu giả. */
export default function AdminContractTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tpl, isLoading } = useContractTemplate(id);
  const { data: all = [] } = useContractTemplates();
  const remove = useDeleteContractTemplate();
  const canCreate = useHasAdminPermission("mau-hop-dong", "create");
  const canDelete = useHasAdminPermission("mau-hop-dong", "delete");
  const [previewing, setPreviewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4 px-6 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  const def = tpl ? templateTypeDef(tpl.template_type) : null;
  if (!tpl || !def) {
    return <div className="px-6 py-8 text-sm text-muted-foreground">Không tìm thấy phiên bản mẫu.</div>;
  }

  const sameType = all.filter((t) => t.template_type === tpl.template_type);
  const status = legalVersionStatus(tpl, sameType.length ? sameType : [tpl], vnTodayStr());
  const missing = placeholderSlots(def.type, tpl.clauses);

  const onPreview = async () => {
    setPreviewing(true);
    try {
      saveBlob(await templateSamplePdfBlob(def.type, tpl.version, tpl.clauses), templateSampleFileName(tpl.version));
    } catch {
      toast.error("Không tạo được PDF xem thử.");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-6 px-6 py-8">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => navigate(`${ADMIN_CONTRACT_TEMPLATES_PATH}?loai=${def.type}`)}
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
        Mẫu hợp đồng
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{tpl.version}</h1>
            <TemplateStatusBadge status={status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {def.label} · hiệu lực {formatDate(tpl.effective_date)}
            {tpl.changelog ? ` · ${tpl.changelog}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canDelete && status === "scheduled" && (
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
              Xoá
            </Button>
          )}
          {canCreate && (
            <Button type="button" variant="outline" onClick={() => navigate(adminContractTemplateCreatePath(def.type, tpl.id))}>
              <Copy className="mr-1.5 h-4 w-4" aria-hidden />
              Nhân bản thành bản mới
            </Button>
          )}
          <Button type="button" onClick={onPreview} disabled={previewing}>
            {previewing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            Xem PDF mẫu
          </Button>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Còn "[CẦN NHẬP]" ở: {missing.map((s) => s.label).join(", ")}.
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <ContractClausesView templateType={def.type} clauses={tpl.clauses} showParty />
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá phiên bản chờ áp dụng?</AlertDialogTitle>
            <AlertDialogDescription>
              {tpl.version} chưa đến ngày hiệu lực nên chưa hợp đồng nào dùng. Xoá xong không khôi phục được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                remove.mutate(tpl.id, { onSuccess: () => navigate(`${ADMIN_CONTRACT_TEMPLATES_PATH}?loai=${def.type}`) })
              }
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { AlertTriangle, Copy, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/dateUtils";
import { classifyLegalVersions, LEGAL_STATUS_LABEL, vnTodayStr, type LegalVersionStatus } from "@/lib/legalStatus";
import { placeholderSlots } from "@/lib/contracts/templates/resolve";
import type { TemplateTypeDef } from "@/lib/contracts/templates/schema";
import type { ContractTemplate } from "@/hooks/useContractTemplates";

export function TemplateStatusBadge({ status }: { status: LegalVersionStatus }) {
  if (status === "active") return <Badge>{LEGAL_STATUS_LABEL.active}</Badge>;
  if (status === "scheduled") return <Badge variant="secondary">{LEGAL_STATUS_LABEL.scheduled}</Badge>;
  return <Badge variant="outline">{LEGAL_STATUS_LABEL.archived}</Badge>;
}

interface Props {
  def: TemplateTypeDef;
  versions: ContractTemplate[];
  isLoading?: boolean;
  canCreate: boolean;
  onCreate: (from?: ContractTemplate) => void;
  onView: (v: ContractTemplate) => void;
}

/** Các phiên bản của MỘT loại mẫu — "đang áp dụng" theo ngày hiệu lực giờ Việt Nam. */
export function TemplateVersionsTable({ def, versions, isLoading, canCreate, onCreate, onView }: Props) {
  const rows = classifyLegalVersions(versions, vnTodayStr());
  const active = rows.find((r) => r.status === "active") ?? null;
  const missing = active ? placeholderSlots(def.type, active.clauses) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{def.label}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {active ? (
              <>
                Đang áp dụng: <span className="font-medium text-foreground">{active.version}</span> · hiệu lực{" "}
                {formatDate(active.effective_date)}
              </>
            ) : (
              "Chưa có phiên bản nào đang áp dụng — hợp đồng dùng câu chữ mặc định trong hệ thống."
            )}
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => onCreate(active ?? undefined)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tạo bản mới
          </Button>
        )}
      </div>

      {missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Bản đang áp dụng còn thông tin "[CẦN NHẬP]": {missing.map((s) => s.label).join(", ")}. Chủ tài sản đang thấy
          đúng các chỗ này khi đồng ý hợp đồng — tạo bản mới để điền.
        </p>
      )}

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phiên bản</TableHead>
              <TableHead>Ngày hiệu lực</TableHead>
              <TableHead>Ghi chú thay đổi</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-28 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có phiên bản.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => onView(v)}>
                  <TableCell className="font-medium">{v.version}</TableCell>
                  <TableCell>{formatDate(v.effective_date)}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{v.changelog || "—"}</TableCell>
                  <TableCell>
                    <TemplateStatusBadge status={v.status} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Xem" aria-label="Xem" onClick={() => onView(v)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canCreate && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Nhân bản thành bản mới"
                          aria-label="Nhân bản thành bản mới"
                          onClick={() => onCreate(v)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

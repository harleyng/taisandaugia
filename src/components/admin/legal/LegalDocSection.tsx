import { Plus, Copy, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/dateUtils";
import {
  classifyLegalVersions,
  LEGAL_STATUS_LABEL,
  type LegalVersionStatus,
} from "@/lib/legalStatus";
import {
  LEGAL_DOC_HREFS,
  LEGAL_DOC_LABELS,
  type LegalDocType,
  type LegalDocument,
} from "@/types/legal";

interface Props {
  docType: LegalDocType;
  versions: LegalDocument[];
  isLoading?: boolean;
  onCreate: () => void;
  onView: (v: LegalDocument) => void;
  onClone: (v: LegalDocument) => void;
}

function StatusBadge({ status }: { status: LegalVersionStatus }) {
  if (status === "active") return <Badge>{LEGAL_STATUS_LABEL.active}</Badge>;
  if (status === "scheduled") return <Badge variant="secondary">{LEGAL_STATUS_LABEL.scheduled}</Badge>;
  return <Badge variant="outline">{LEGAL_STATUS_LABEL.archived}</Badge>;
}

export function LegalDocSection({ docType, versions, isLoading, onCreate, onView, onClone }: Props) {
  const rows = classifyLegalVersions(versions);
  const active = rows.find((r) => r.status === "active") ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{LEGAL_DOC_LABELS[docType]}</h2>
            <a
              href={LEGAL_DOC_HREFS[docType]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              title="Xem trang công khai"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {active ? (
              <>
                Đang áp dụng: <span className="font-medium text-foreground">{active.version}</span>{" "}
                · hiệu lực {formatDate(active.effective_date)}
              </>
            ) : (
              "Chưa có phiên bản nào đang áp dụng"
            )}
          </p>
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Tạo bản mới
        </Button>
      </div>

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
                  Chưa có phiên bản. Nhấn &quot;Tạo bản mới&quot; để bắt đầu.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((v) => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer"
                  onClick={() => onView(v)}
                >
                  <TableCell className="font-medium">{v.version}</TableCell>
                  <TableCell>{formatDate(v.effective_date)}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {v.changelog || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={v.status} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Xem chi tiết" onClick={() => onView(v)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Nhân bản" onClick={() => onClone(v)}>
                        <Copy className="h-4 w-4" />
                      </Button>
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

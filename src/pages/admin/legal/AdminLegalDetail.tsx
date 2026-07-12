import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLegalDocuments, useLegalVersion } from "@/hooks/useLegalDocuments";
import { legalVersionStatus, LEGAL_STATUS_LABEL } from "@/lib/legalStatus";
import { formatDate } from "@/lib/dateUtils";
import { LEGAL_DOC_HREFS, LEGAL_DOC_LABELS } from "@/types/legal";

export default function AdminLegalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: version, isLoading } = useLegalVersion(id);
  const { data: allDocs } = useLegalDocuments();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!version) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Không tìm thấy phiên bản.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/admin/phap-ly")}>
          Về danh sách
        </Button>
      </div>
    );
  }

  const sameType = (allDocs ?? []).filter((d) => d.doc_type === version.doc_type);
  const status = legalVersionStatus(version, sameType);

  const meta = [
    { label: "Loại văn bản", value: LEGAL_DOC_LABELS[version.doc_type] },
    { label: "Phiên bản", value: version.version },
    { label: "Ngày hiệu lực", value: formatDate(version.effective_date) },
    { label: "Ngày tạo", value: formatDate(version.created_at) },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/phap-ly")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">
            {LEGAL_DOC_LABELS[version.doc_type]} · {version.version}
          </h1>
          <Badge variant={status === "active" ? "default" : status === "scheduled" ? "secondary" : "outline"}>
            {LEGAL_STATUS_LABEL[status]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(LEGAL_DOC_HREFS[version.doc_type], "_blank", "noopener")}
          >
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Xem trang công khai
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/phap-ly/tao?type=${version.doc_type}&from=${version.id}`)}
          >
            <Copy className="mr-1.5 h-4 w-4" />
            Nhân bản
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {meta.map((m) => (
            <div key={m.label}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{m.value}</p>
            </div>
          ))}
        </div>
        {version.changelog && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ghi chú thay đổi</p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-foreground">{version.changelog}</p>
          </div>
        )}
      </div>

      {/* Nội dung */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Nội dung</h2>
        {version.content ? (
          <div
            className="article-body text-[15px] leading-[1.8] text-foreground/90"
            dangerouslySetInnerHTML={{ __html: version.content }}
          />
        ) : (
          <p className="italic text-muted-foreground">Chưa có nội dung.</p>
        )}
      </div>
    </div>
  );
}

import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { SOURCE_LABELS, LEAD_TYPE_LABELS } from "@/lib/leads/leadStatus";
import {
  ENTITY_ROLE_LABELS, ONBOARD_STATUS_LABELS, entityRole, prospectSubtypeLabel,
  showSubtypeUnderRole,
  type EntityType, type OnboardStatus, type ProspectSubtype,
} from "@/lib/prospects/types";
import type { Lead } from "@/types/leads";
import type { CustomerSegment } from "@/lib/customers/customerSegment";

const Card = ({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
      {icon}
      {title}
    </h2>
    {children}
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="rounded-lg bg-muted/40 px-4 py-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="text-sm font-medium text-foreground mt-0.5 break-words">{children}</div>
  </div>
);

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

interface Props {
  lead: Lead;
  onboardStatus?: OnboardStatus;
  /** Cá nhân / tổ chức + hình thức chi tiết — chỉ có với lead nguồn dữ liệu sàn. */
  entityType?: EntityType;
  subtype?: ProspectSubtype | null;
  /** Tên công ty mẹ, khi pháp nhân này là đơn vị thành viên của nơi khác. */
  parentName?: string | null;
  parentId?: string | null;
  /** Số liệu tài sản — chỉ có với lead nguồn dữ liệu sàn. */
  assetSummary?: { listings: number; provinces: number } | null;
}

export function LeadInfoTab({
  lead, onboardStatus, entityType, subtype, parentName, parentId, assetSummary,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <Card title="Thông tin cơ bản">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Mã khách hàng tiềm năng">
            <span className="font-mono text-primary">{lead.code ?? "—"}</span>
          </Field>
          <Field label="Loại">{LEAD_TYPE_LABELS[lead.lead_type as CustomerSegment] ?? "Khác"}</Field>
          <Field label="Nguồn">{SOURCE_LABELS[lead.source] ?? lead.source}</Field>
          <Field label="Tỉnh/Thành phố">{lead.province || "—"}</Field>
          <Field label="Ngày tạo">{fmtDateTime(lead.created_at)}</Field>
          <Field label="Cập nhật gần nhất">{fmtDateTime(lead.updated_at)}</Field>
          <Field label="Người phụ trách">
            {lead.assignee?.name || lead.assignee?.email || "Chưa giao"}
          </Field>
          {entityType && (
            <Field label="Loại hình">
              {ENTITY_ROLE_LABELS[entityRole(entityType, parentId)]}
              {showSubtypeUnderRole(entityRole(entityType, parentId), subtype) && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {prospectSubtypeLabel(subtype)}
                </span>
              )}
            </Field>
          )}
          {parentName && <Field label="Trực thuộc">{parentName}</Field>}
          {onboardStatus && (
            <Field label="Quan hệ với sàn">{ONBOARD_STATUS_LABELS[onboardStatus]}</Field>
          )}
        </div>
      </Card>

      <Card title="Liên hệ">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Tên tổ chức">{lead.company_name || "—"}</Field>
          <Field label="Người liên hệ">{lead.contact_name || "—"}</Field>
          <Field label="Số điện thoại">
            {lead.phone ? <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a> : "—"}
          </Field>
          <Field label="Email">
            {lead.email ? <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a> : "—"}
          </Field>
        </div>
      </Card>

      {assetSummary && (
        <Card title="Tài sản trên sàn">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-foreground">
              <strong className="tabular-nums">{assetSummary.listings}</strong> tài sản
              {" · "}
              <strong className="tabular-nums">{assetSummary.provinces}</strong> tỉnh/thành
            </span>
            <span className="text-xs text-muted-foreground">
              Xem chi tiết ở tab <strong>Lịch sử đấu giá</strong>.
            </span>
          </div>
        </Card>
      )}

      <Card title="Ghi chú">
        {lead.note ? (
          <p className="text-sm text-foreground whitespace-pre-wrap">{lead.note}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Chưa có ghi chú</p>
        )}
      </Card>

      {lead.converted_customer && (
        <Card title="Đã chuyển đổi thành khách hàng">
          <button
            onClick={() => navigate(`/admin/khach-hang/${lead.converted_customer!.id}`)}
            className="w-full flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3 text-left hover:bg-muted transition-colors"
          >
            <Badge variant="secondary" className="font-mono">
              {lead.converted_customer.code ?? "—"}
            </Badge>
            <span className="flex-1 text-sm font-medium text-foreground">
              {lead.converted_customer.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {fmtDateTime(lead.converted_at)}
            </span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </button>
        </Card>
      )}
    </div>
  );
}

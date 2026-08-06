import { ExternalLink, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useProfileBrief } from "@/hooks/useProfiles";
import { segmentLabel } from "@/lib/customers/customerSegment";
import { CUSTOMER_TYPE_LABELS, STATUS_LABELS } from "@/lib/customers/customerStatus";
import { SOURCE_LABELS } from "@/lib/leads/leadStatus";
import {
  ENTITY_ROLE_LABELS, ONBOARD_STATUS_LABELS, entityRole, prospectSubtypeLabel,
  type EntityType, type OnboardStatus, type ProspectSubtype,
} from "@/lib/prospects/types";
import type { Customer } from "@/types/customers";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
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
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

interface Props {
  customer: Customer;
  onboardStatus?: OnboardStatus;
  /** Cá nhân / tổ chức + hình thức chi tiết — chỉ có với khách gắn pháp nhân sàn. */
  entityType?: EntityType;
  subtype?: ProspectSubtype | null;
  parentName?: string | null;
  parentId?: string | null;
  assetSummary?: { listings: number; provinces: number } | null;
}

export function CustomerInfoTab({
  customer, onboardStatus, entityType, subtype, parentName, parentId, assetSummary,
}: Props) {
  const navigate = useNavigate();
  const { data: account, isLoading: loadingAccount } = useProfileBrief(customer.user_id);

  return (
    <div className="space-y-4">
      <Card title="Thông tin cơ bản">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Mã khách hàng">
            <span className="font-mono text-primary">{customer.code ?? "—"}</span>
          </Field>
          <Field label="Phân khúc">{segmentLabel(customer.segment)}</Field>
          <Field label="Loại">{CUSTOMER_TYPE_LABELS[customer.customer_type]}</Field>
          <Field label="Trạng thái">{STATUS_LABELS[customer.status]}</Field>
          <Field label="Ngày tạo">{fmtDateTime(customer.created_at)}</Field>
          <Field label="Cập nhật gần nhất">{fmtDateTime(customer.updated_at)}</Field>
          {entityType && (
            <Field label="Loại hình">
              {ENTITY_ROLE_LABELS[entityRole(entityType, parentId)]}
              {subtype && subtype !== entityType && (
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
          <Field label="Người liên hệ">{customer.contact_name || "—"}</Field>
          <Field label="Số điện thoại">
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
            ) : "—"}
          </Field>
          <Field label="Email">
            {customer.email ? (
              <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
            ) : "—"}
          </Field>
          <Field label="Mã số thuế">{customer.tax_code || "—"}</Field>
          <Field label="Địa chỉ">{customer.address || "—"}</Field>
        </div>
      </Card>

      {/* Tài khoản sàn là cầu nối tới email marketing và đơn nạp credit — nói rõ
          hệ quả khi chưa gắn để admin biết vì sao tab Chiến dịch trống. */}
      <Card title="Tài khoản trên sàn">
        {customer.user_id ? (
          <button
            onClick={() => navigate(`/admin/nguoi-dung/${customer.user_id}`)}
            className="w-full flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3 text-left hover:bg-muted transition-colors"
          >
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">
                {loadingAccount ? "Đang tải…" : account?.name || "Không tên"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {account?.email ?? customer.user_id}
              </span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Chưa gắn tài khoản. Bấm <strong className="text-foreground">Sửa</strong> để gắn — cần
            có tài khoản mới xem được chiến dịch email marketing và đơn nạp credit của khách hàng này.
          </p>
        )}
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
        {customer.note ? (
          <p className="text-sm text-foreground whitespace-pre-wrap">{customer.note}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Chưa có ghi chú</p>
        )}
      </Card>

      {/* Nguồn gốc — mã lead lưu ở customers.source_lead_id. Chiều ngược của
          card "Đã chuyển đổi thành khách hàng" bên trang lead. */}
      <Card title="Chuyển đổi từ khách hàng tiềm năng">
        {customer.source_lead ? (
          <button
            onClick={() => navigate(`/admin/khach-hang-tiem-nang/${customer.source_lead!.id}`)}
            className="w-full flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3 text-left hover:bg-muted transition-colors"
          >
            <Badge variant="secondary" className="font-mono">
              {customer.source_lead.code ?? "—"}
            </Badge>
            <span className="flex-1 text-sm font-medium text-foreground min-w-0 truncate">
              {customer.source_lead.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {SOURCE_LABELS[customer.source_lead.source] ?? customer.source_lead.source}
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Khách hàng nhập trực tiếp, không đến từ khách hàng tiềm năng nào.
          </p>
        )}
      </Card>
    </div>
  );
}

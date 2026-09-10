import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Pencil, User, Mail } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { renderDeltaValue } from "@/components/asset-posting/format";
import { formatPrice } from "@/utils/formatters";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useAdminAssetPosting } from "@/hooks/useAdminAssetPostings";
import { AssetPostingReviewPanel } from "@/components/admin/asset-postings/AssetPostingReviewPanel";
import { AssetPostingEditForm } from "@/components/admin/asset-postings/AssetPostingEditForm";
import { AssetPostingFilesCard } from "@/components/admin/asset-postings/AssetPostingFilesCard";
import { ConsignmentCard } from "@/components/admin/consignment/ConsignmentCard";
import {
  ASSET_POSTING_STATUS_LABELS,
  AUCTION_FORMAT_LABELS,
  EXPECTED_TIMELINE_LABELS,
  PRICING_MODE_LABELS,
  type AuctionFormat,
  type ExpectedTimeline,
  type PricingMode,
} from "@/types/asset-posting";

const PARENT_NAME: Record<string, string> = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.name]));
const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

const flag = (v: boolean | null) => (v === null ? "—" : v ? "Có" : "Không");

export default function AdminAssetPostingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { listSearch?: string } };
  const { data: p, isLoading } = useAdminAssetPosting(id);
  const canEdit = useHasAdminPermission("tai-san-tu-nguyen", "update");
  const [editing, setEditing] = useState(false);

  const back = () => navigate(`/admin/tai-san${state?.listSearch ?? ""}`);

  if (isLoading) {
    return <div className="px-6 py-12 text-center text-sm text-muted-foreground">Đang tải...</div>;
  }
  if (!p) {
    return (
      <div className="space-y-4 px-6 py-8">
        <button onClick={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Danh sách tài sản
        </button>
        <p className="text-sm text-muted-foreground">Không tìm thấy hồ sơ tài sản.</p>
      </div>
    );
  }

  const descriptors = getDeltaFields(p.child_slug);
  const location = [p.address, p.ward, p.district, p.province].filter(Boolean).join(", ");

  return (
    <div className="space-y-6 px-6 py-8">
      <button onClick={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Danh sách tài sản
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold text-foreground">{p.title}</h1>
          <p className="text-sm text-muted-foreground">
            {PARENT_NAME[p.parent_slug] ?? p.parent_slug} · {CHILD_LABEL[p.child_slug] ?? p.child_slug} ·{" "}
            {ASSET_POSTING_STATUS_LABELS[p.status] ?? p.status}
          </p>
        </div>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Bổ sung thông tin
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {editing ? (
            <AssetPostingEditForm posting={p} onDone={() => setEditing(false)} />
          ) : (
            <>
              <SectionCard title="Người nộp hồ sơ">
                <Row
                  label="Chủ tài sản"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {p.profiles?.name ?? "—"}
                    </span>
                  }
                />
                <Row
                  label="Email"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {p.profiles?.email ?? "—"}
                    </span>
                  }
                />
                <Row
                  label="Số hoá lúc"
                  value={
                    p.submitted_at
                      ? format(new Date(p.submitted_at), "HH:mm dd/MM/yyyy", { locale: vi })
                      : "Chưa hoàn tất"
                  }
                />
              </SectionCard>

              <SectionCard title="Thông tin chung">
                <Row label="Khu vực" value={location || "—"} />
                {p.description && <p className="whitespace-pre-line text-sm text-foreground">{p.description}</p>}
              </SectionCard>

              {descriptors.length > 0 && (
                <SectionCard title="Thông số tài sản">
                  <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {descriptors.map((d) => (
                      <Row key={d.key} label={d.label} value={renderDeltaValue(d, p.delta_fields?.[d.key])} />
                    ))}
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Nhu cầu đấu giá">
                <Row label="Cách định giá" value={PRICING_MODE_LABELS[p.pricing_mode as PricingMode]} />
                <Row
                  label="Giá khởi điểm"
                  value={p.starting_price ? formatPrice(p.starting_price, "TOTAL") : "Nhờ định giá"}
                />
                <Row label="Hình thức" value={AUCTION_FORMAT_LABELS[p.auction_format as AuctionFormat]} />
                {p.commission_pct != null && <Row label="Thù lao chấp nhận" value={`${p.commission_pct}%`} />}
                {p.expected_timeline && (
                  <Row
                    label="Thời gian kỳ vọng"
                    value={EXPECTED_TIMELINE_LABELS[p.expected_timeline as ExpectedTimeline]}
                  />
                )}
              </SectionCard>

              <SectionCard title="Pháp lý & hiện trạng">
                <Row label="Quyền được bán" value={p.right_to_sell ? "Có" : "Chưa xác nhận"} />
                <Row label="Đang tranh chấp" value={flag(p.has_dispute)} />
                <Row label="Đang thế chấp" value={flag(p.has_mortgage)} />
                <Row label="Bị kê biên" value={flag(p.is_seized)} />
                {p.legal_notes && <Row label="Ghi chú" value={p.legal_notes} />}
              </SectionCard>

              <SectionCard title="Giấy tờ & hình ảnh">
                <AssetPostingFilesCard posting={p} />
              </SectionCard>

              <SectionCard title="Tổ chức đấu giá">
                <ConsignmentCard posting={p} />
              </SectionCard>
            </>
          )}
        </div>

        <AssetPostingReviewPanel posting={p} />
      </div>
    </div>
  );
}

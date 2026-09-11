import { ArrowLeft, Loader2, FileText, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { formatPrice } from "@/utils/formatters";
import { ConsignmentPanel } from "./ConsignmentPanel";
import { SendToOrgsCard } from "./SendToOrgsCard";
import { renderDeltaValue } from "./format";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { REVIEW_STATUS_BADGE_CLASS, REVIEW_STATUS_LABELS } from "@/lib/asset-posting/reviewStatus";
import {
  ASSET_POSTING_STATUS_LABELS,
  AUCTION_FORMAT_LABELS,
  EXPECTED_TIMELINE_LABELS,
  type AssetPostingStatus,
  type AuctionFormat,
  type ExpectedTimeline,
} from "@/types/asset-posting";
import { useCancelBrokerRequest, usePostingDetail } from "@/hooks/useAssetPosting";
import { usePostingContracts } from "@/hooks/useConsignmentContract";

const PARENT_NAME: Record<string, string> = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.name]));
const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

const STATUS_STYLE: Record<AssetPostingStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  matched: "bg-primary/10 text-primary",
  contracted: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const fileName = (path: string) => path.split("/").pop() ?? path;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right font-medium">{value}</span>
    </div>
  );
}

interface AssetPostingDetailProps {
  postingId: string;
  onBack: () => void;
}

/** Màn chi tiết một hồ sơ tài sản đấu giá. */
export function AssetPostingDetail({ postingId, onBack }: AssetPostingDetailProps) {
  const { data, isLoading } = usePostingDetail(postingId);
  const cancelBroker = useCancelBrokerRequest();
  const { data: contracts } = usePostingContracts(postingId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Danh sách tài sản
        </button>
        <p className="text-sm text-muted-foreground">Không tìm thấy hồ sơ tài sản.</p>
      </div>
    );
  }

  const { posting: p, org, requests, brokerRequest } = data;
  const descriptors = getDeltaFields(p.child_slug);
  const location = [p.address, p.ward, p.district, p.province].filter(Boolean).join(", ");
  const legalFlag = (v: boolean | null) => (v === null ? "—" : v ? "Có" : "Không");
  const allDocs = [...p.ownership_proof_urls, ...p.doc_urls];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách tài sản
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">{p.title}</h1>
          <p className="text-sm text-muted-foreground">
            {PARENT_NAME[p.parent_slug] ?? p.parent_slug} · {CHILD_LABEL[p.child_slug] ?? p.child_slug}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {/* Suy ra từ hợp đồng — KHÔNG ghi asset_postings.status (trigger review guard). */}
          {contracts?.some((c) => c.status === "signed") && (
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
              Đã ký hợp đồng
            </span>
          )}
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLE[p.status]}`}>
            {ASSET_POSTING_STATUS_LABELS[p.status]}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${REVIEW_STATUS_BADGE_CLASS[p.review_status]}`}
          >
            {REVIEW_STATUS_LABELS[p.review_status]}
          </span>
        </div>
      </div>

      {/* Hồ sơ đã số hoá nhưng CHƯA được duyệt: chưa gửi cho tổ chức đấu giá được. */}
      {p.status === "active" && requests.length === 0 && p.review_status === "pending" && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 pt-5">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Hồ sơ đang chờ duyệt</p>
              <p className="text-sm text-muted-foreground">
                Quản trị viên đang xem xét hồ sơ tài sản của bạn. Sau khi được duyệt, bạn có thể gửi
                hồ sơ cho tổ chức đấu giá.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bị từ chối: hiện lý do để chủ tài sản sửa rồi lưu lại (lưu lại sẽ được duyệt lại). */}
      {p.review_status === "rejected" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Hồ sơ chưa được duyệt</p>
              {p.rejection_reason && (
                <p className="text-sm text-foreground">{p.rejection_reason}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Vui lòng cập nhật hồ sơ theo góp ý trên. Hồ sơ sẽ được xem xét lại sau khi bạn lưu.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <SendToOrgsCard posting={p} requests={requests} brokerRequest={brokerRequest} />

      {/* Trạng thái ký gửi: tiến trình nhờ sàn · báo giá · tổ chức đã chọn */}
      <ConsignmentPanel
        posting={p}
        requests={requests}
        brokerRequest={brokerRequest}
        org={org}
        onCancelBroker={() =>
          brokerRequest && cancelBroker.mutate({ brokerRequestId: brokerRequest.id, postingId: p.id })
        }
        isCancelling={cancelBroker.isPending}
      />

      <Card>
        <CardContent className="pt-5 space-y-6">
          {/* Khu vực & mô tả */}
          <Section title="Thông tin chung">
            {location && <Row label="Khu vực" value={location} />}
            {p.description && <p className="text-sm text-foreground whitespace-pre-line">{p.description}</p>}
          </Section>

          {/* Thông số riêng */}
          {descriptors.length > 0 && (
            <>
              <Separator />
              <Section title="Thông số tài sản">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {descriptors.map((d) => (
                    <Row key={d.key} label={d.label} value={renderDeltaValue(d, p.delta_fields?.[d.key])} />
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* Nhu cầu đấu giá */}
          <Separator />
          <Section title="Nhu cầu đấu giá">
            <Row
              label="Giá khởi điểm"
              value={p.starting_price ? formatPrice(p.starting_price, "TOTAL") : "Nhờ định giá"}
            />
            <Row label="Hình thức" value={AUCTION_FORMAT_LABELS[p.auction_format as AuctionFormat]} />
            {p.commission_pct != null && <Row label="Thù lao chấp nhận" value={`${p.commission_pct}%`} />}
            {p.expected_timeline && (
              <Row label="Thời gian kỳ vọng" value={EXPECTED_TIMELINE_LABELS[p.expected_timeline as ExpectedTimeline]} />
            )}
          </Section>

          {/* Pháp lý */}
          <Separator />
          <Section title="Pháp lý & hiện trạng">
            <Row label="Quyền được bán" value={p.right_to_sell ? "Có" : "Chưa xác nhận"} />
            <Row label="Đang tranh chấp" value={legalFlag(p.has_dispute)} />
            <Row label="Đang thế chấp" value={legalFlag(p.has_mortgage)} />
            <Row label="Bị kê biên" value={legalFlag(p.is_seized)} />
            {p.legal_notes && <Row label="Ghi chú" value={p.legal_notes} />}
            {p.ownership_declaration && (
              <>
                <Row label="Bản cam kết" value="Đã ký điện tử" />
                <Row label="Người cam kết" value={p.ownership_declaration.name} />
                <Row label="Thời điểm ký" value={format(new Date(p.ownership_declaration.accepted_at), "HH:mm dd/MM/yyyy", { locale: vi })} />
                <Row label="Phiên bản cam kết" value={p.ownership_declaration.version} />
              </>
            )}
            {allDocs.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {allDocs.map((d) => (
                  <div key={d} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{fileName(d)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Ảnh */}
          {p.image_urls.length > 0 && (
            <>
              <Separator />
              <Section title="Ảnh tài sản">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {p.image_urls.map((url, i) => (
                    <div key={url} className="aspect-square rounded-lg overflow-hidden bg-muted">
                      <img src={url} alt={`Ảnh ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* Video */}
          {p.video_urls?.length > 0 && (
            <>
              <Separator />
              <Section title="Video tài sản">
                <div className="space-y-2.5">
                  {p.video_urls.map((url) => (
                    <video key={url} src={url} controls preload="metadata" className="w-full rounded-lg bg-black" />
                  ))}
                </div>
              </Section>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

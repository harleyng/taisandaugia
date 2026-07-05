import { ArrowLeft, Loader2, FileText, Building2, MapPin, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { getDeltaFields, type DeltaFieldDescriptor } from "@/constants/asset-delta-fields";
import { formatPrice } from "@/utils/formatters";
import {
  ASSET_POSTING_STATUS_LABELS,
  AUCTION_FORMAT_LABELS,
  EXPECTED_TIMELINE_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  type AssetPostingStatus,
  type AuctionFormat,
  type ExpectedTimeline,
} from "@/types/asset-posting";
import { usePostingDetail } from "@/hooks/useAssetPosting";

const PARENT_NAME: Record<string, string> = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.name]));
const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

const STATUS_STYLE: Record<AssetPostingStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/10 text-warning",
  matched: "bg-primary/10 text-primary",
  contracted: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const fileName = (path: string) => path.split("/").pop() ?? path;

function renderDeltaValue(d: DeltaFieldDescriptor, raw: unknown): string {
  if (raw === null || raw === undefined || String(raw).trim() === "") return "—";
  if (d.type === "select") return d.options?.find((o) => o.value === raw)?.label ?? String(raw);
  if (d.type === "boolean") return raw ? "Có" : "Không";
  const base = d.type === "number" ? Number(raw).toLocaleString("vi-VN") : String(raw);
  return d.unit ? `${base} ${d.unit}` : base;
}

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

  const { posting: p, org, request } = data;
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
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLE[p.status]}`}>
          {ASSET_POSTING_STATUS_LABELS[p.status]}
        </span>
      </div>

      {/* Tổ chức đấu giá đã chọn */}
      {org && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-3">
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.name} className="h-11 w-11 rounded-lg object-cover" />
              ) : (
                <div className="h-11 w-11 rounded-lg bg-background flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{org.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {org.province && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {org.province}
                    </span>
                  )}
                  {org.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {org.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {request && (
              <>
                <Separator />
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Trạng thái yêu cầu</span>
                  <Badge variant="secondary" className="font-normal">
                    {SERVICE_REQUEST_STATUS_LABELS[request.status]}
                  </Badge>
                </div>
                {request.match_score != null && <Row label="Điểm khớp" value={`${Math.round(request.match_score)}/100`} />}
                {request.message && (
                  <p className="text-sm text-foreground bg-background rounded-lg p-3 border border-border">
                    “{request.message}”
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

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
        </CardContent>
      </Card>
    </div>
  );
}

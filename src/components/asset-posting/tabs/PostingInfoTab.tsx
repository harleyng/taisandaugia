import { FileText } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { formatPrice } from "@/utils/formatters";
import { renderDeltaValue } from "../format";
import {
  AUCTION_FORMAT_LABELS,
  EXPECTED_TIMELINE_LABELS,
  type AssetPosting,
  type AuctionFormat,
  type ExpectedTimeline,
} from "@/types/asset-posting";

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

/** Toàn bộ nội dung đã số hoá của hồ sơ — tab "Thông tin". */
export function PostingInfoTab({ posting: p }: { posting: AssetPosting }) {
  const descriptors = getDeltaFields(p.child_slug);
  const location = [p.address, p.ward, p.district, p.province].filter(Boolean).join(", ");
  const legalFlag = (v: boolean | null) => (v === null ? "—" : v ? "Có" : "Không");
  const allDocs = [...p.ownership_proof_urls, ...p.doc_urls];

  return (
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
              <Row
                label="Thời điểm ký"
                value={format(new Date(p.ownership_declaration.accepted_at), "HH:mm dd/MM/yyyy", { locale: vi })}
              />
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
  );
}

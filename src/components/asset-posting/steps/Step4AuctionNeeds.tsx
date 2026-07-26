import { AlertCircle, Camera, Check, Clock, Landmark, Loader2, Tag } from "lucide-react";
import { AUCTION_FORMAT_LABELS, EXPECTED_TIMELINE_LABELS, type AuctionFormat, type ExpectedTimeline } from "@/types/asset-posting";
import type { OrgMatchResult } from "@/lib/orgMatching";
import { AssetMediaUpload } from "../AssetMediaUpload";
import { AssetDocUpload } from "../AssetDocUpload";
import { Group, OptionalGroup, TextField, SelectField, WideRadio, Pill } from "../fields";
import { groupNumber, parseNumber, vnWords } from "../format";
import type { WizardValues } from "../wizardSchema";

interface StepProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  errs: Record<string, string>;
  orgResults: OrgMatchResult[];
  orgLoading: boolean;
}

const FORMATS = Object.keys(AUCTION_FORMAT_LABELS) as AuctionFormat[];
const TIMELINES = (Object.keys(EXPECTED_TIMELINE_LABELS) as ExpectedTimeline[]).map((v) => ({
  value: v,
  label: EXPECTED_TIMELINE_LABELS[v],
}));

/** Bước 4: quyết định đấu giá (có/chưa) → nếu có: giá + hình thức + tổ chức + tùy chọn. */
export function Step4AuctionNeeds({ f, up, errs, orgResults, orgLoading }: StepProps) {
  const want = f.wantsAuction;

  return (
    <div className="flex flex-col gap-4">
      <Group icon={<Landmark className="h-4 w-4" />} title="Nhu cầu đấu giá">
        <label className="block text-[13.5px] font-semibold text-foreground mb-2">
          Bạn có muốn đưa tài sản này ra đấu giá?<span className="ml-0.5 text-destructive">*</span>
        </label>
        <div className="flex flex-col gap-2.5">
          {[
            { v: "yes", t: "Có — tôi muốn đấu giá", d: "Khai giá khởi điểm, hình thức và chọn tổ chức ký gửi." },
            { v: "no", t: "Chưa — chỉ số hoá & lưu hồ sơ", d: "Hồ sơ lưu trong “Tài sản của tôi”, gửi đấu giá sau." },
          ].map((o) => (
            <WideRadio key={o.v} on={want === o.v} onClick={() => up({ wantsAuction: o.v as "yes" | "no", chosenOrg: null })}>
              <span className="text-sm font-semibold text-foreground block">{o.t}</span>
              <span className="text-xs text-muted-foreground block mt-0.5">{o.d}</span>
            </WideRadio>
          ))}
        </div>
        {errs.wantsAuction && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive mt-2.5">
            <AlertCircle className="h-3.5 w-3.5" /> {errs.wantsAuction}
          </div>
        )}
      </Group>

      {want === "yes" && (
        <>
          <Group icon={<Tag className="h-4 w-4" />} title="Giá khởi điểm & hình thức">
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-2">
                <label className="text-[13.5px] font-semibold text-foreground">
                  Cách xác định giá<span className="ml-0.5 text-destructive">*</span>
                </label>
                <div className="flex flex-col gap-2.5">
                  {[
                    { v: "self", t: "Tôi tự đưa ra giá khởi điểm" },
                    { v: "appraisal", t: "Nhờ tổ chức đấu giá định giá" },
                  ].map((o) => (
                    <WideRadio key={o.v} on={f.pricingMode === o.v} onClick={() => up({ pricingMode: o.v as "self" | "appraisal" })}>
                      <span className="text-sm font-semibold text-foreground">{o.t}</span>
                    </WideRadio>
                  ))}
                </div>
              </div>

              {f.pricingMode === "self" && (
                <TextField
                  label="Mức giá mong muốn"
                  req
                  type="number"
                  unit="VNĐ"
                  help={f.startingPrice ? vnWords(f.startingPrice) : undefined}
                  placeholder="0"
                  value={groupNumber(f.startingPrice ?? "")}
                  onChange={(v) => up({ startingPrice: parseNumber(v) })}
                  err={errs.startingPrice}
                />
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[13.5px] font-semibold text-foreground">
                  Hình thức đấu giá<span className="ml-0.5 text-destructive">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map((v) => {
                    const on = f.auctionFormat === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => up({ auctionFormat: v })}
                        className={`inline-flex items-center gap-1.5 border-[1.5px] rounded-[9px] px-3.5 py-2 text-[13.5px] transition ${
                          on ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border font-medium hover:border-primary"
                        }`}
                      >
                        {on && <Check className="h-3.5 w-3.5" />} {AUCTION_FORMAT_LABELS[v]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Group>

          <Group
            icon={<Landmark className="h-4 w-4" />}
            title="Tổ chức đấu giá ký gửi"
            desc="Có thể chọn sau khi số hoá"
            right={f.chosenOrg ? <Pill tone="ok">Đã chọn</Pill> : null}
          >
            {orgLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : orgResults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Chưa tìm thấy tổ chức phù hợp. Bạn vẫn có thể hoàn tất số hoá và gửi cho tổ chức sau.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {orgResults.slice(0, 5).map((r) => {
                  const on = f.chosenOrg === r.org.id;
                  const meta = [r.org.province, `${r.attrs.successful_sessions} phiên`, `thù lao ~${r.attrs.commission_rate}%`]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <WideRadio key={r.org.id} on={on} onClick={() => up({ chosenOrg: on ? null : r.org.id })}>
                      <span className="text-sm font-semibold text-foreground flex items-center gap-2.5">
                        {r.org.name}
                        <Pill tone="ok">{Math.round(r.score)}%</Pill>
                      </span>
                      <span className="text-xs text-muted-foreground block mt-0.5">{meta}</span>
                    </WideRadio>
                  );
                })}
              </div>
            )}
          </Group>

          <OptionalGroup
            icon={<Camera className="h-4 w-4" />}
            title="Thù lao, thời gian & ảnh tài sản"
            desc="Giúp gợi ý tổ chức chính xác hơn"
            count={4}
          >
            <div className="flex flex-col gap-[18px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField
                  label="Thù lao chấp nhận"
                  type="number"
                  unit="%"
                  placeholder="2"
                  value={f.commissionPct ?? ""}
                  onChange={(v) => up({ commissionPct: v })}
                />
                <SelectField
                  label="Thời gian kỳ vọng"
                  options={TIMELINES}
                  value={f.expectedTimeline ?? ""}
                  onChange={(v) => up({ expectedTimeline: v })}
                  placeholder="Chọn mốc thời gian"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground mb-2">
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" /> Ảnh thực tế tài sản
                </label>
                <AssetMediaUpload value={f.imageUrls} onChange={(v) => up({ imageUrls: v })} />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground mb-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Tài liệu bổ sung
                </label>
                <AssetDocUpload value={f.docUrls} onChange={(v) => up({ docUrls: v })} prefix="extra" />
              </div>
            </div>
          </OptionalGroup>
        </>
      )}
    </div>
  );
}

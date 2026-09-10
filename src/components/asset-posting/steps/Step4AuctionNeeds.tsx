import { AlertCircle, Camera, Check, Clock, Landmark, Loader2, Tag } from "lucide-react";
import { AUCTION_FORMAT_LABELS, EXPECTED_TIMELINE_LABELS, type AuctionFormat, type ExpectedTimeline } from "@/types/asset-posting";
import type { OrgMatchResult } from "@/lib/orgMatching";
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
            desc="Có thể quyết định sau khi số hoá"
            right={
              f.orgMode === "platform" ? (
                <Pill tone="ok">Nhờ sàn</Pill>
              ) : f.chosenOrg ? (
                <Pill tone="ok">Đã chọn</Pill>
              ) : null
            }
          >
            <div className="flex flex-col gap-2.5">
              {[
                {
                  v: "self",
                  t: "Tôi tự chọn tổ chức",
                  d: "Xem danh sách tổ chức phù hợp và chọn nơi ký gửi.",
                },
                {
                  v: "platform",
                  t: "Nhờ sàn chọn giúp",
                  d: "Sàn gửi hồ sơ tới nhiều tổ chức, bạn so sánh báo giá rồi chọn. Miễn phí.",
                },
                {
                  v: "",
                  t: "Để quyết định sau",
                  d: "Số hoá trước, gửi cho tổ chức bất cứ lúc nào từ trang hồ sơ.",
                },
              ].map((o) => (
                <WideRadio
                  key={o.v || "later"}
                  on={f.orgMode === o.v}
                  onClick={() => up({ orgMode: o.v as "" | "self" | "platform", chosenOrg: null })}
                >
                  <span className="text-sm font-semibold text-foreground block">{o.t}</span>
                  <span className="text-xs text-muted-foreground block mt-0.5">{o.d}</span>
                </WideRadio>
              ))}
            </div>

            {f.orgMode === "self" && (
              <div className="mt-4">
                {orgLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : orgResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Chưa có tổ chức nào trên sàn khớp tiêu chí này. Hãy chọn “Nhờ sàn chọn giúp” — sàn sẽ tìm hộ bạn.
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
              </div>
            )}

            {f.orgMode === "platform" && (
              <div className="mt-4 flex flex-col gap-3">
                <ol className="flex flex-col gap-1.5 rounded-xl bg-primary/5 border border-primary/20 p-3 text-[13px] text-foreground">
                  <li>1. Sàn thẩm định hồ sơ rồi gửi tới các tổ chức đấu giá phù hợp.</li>
                  <li>2. Tổ chức quan tâm sẽ gửi báo giá (thù lao, phí, thời gian).</li>
                  <li>3. Bạn so sánh và chọn tổ chức mình muốn ký gửi.</li>
                </ol>
                <TextField
                  label="Lời nhắn cho sàn"
                  placeholder="Mong muốn cụ thể của bạn về phiên đấu giá..."
                  value={f.brokerNote ?? ""}
                  onChange={(v) => up({ brokerNote: v })}
                />
              </div>
            )}
          </Group>

          <OptionalGroup
            icon={<Clock className="h-4 w-4" />}
            title="Thù lao & thời gian"
            desc="Giúp gợi ý tổ chức chính xác hơn"
            count={2}
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
            </div>
          </OptionalGroup>
        </>
      )}
    </div>
  );
}

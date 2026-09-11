import { AlertCircle, Check, Clock, Landmark, Tag } from "lucide-react";
import { MAX_RFQ_ORGS } from "@/constants/asset-posting-rules";
import { AUCTION_FORMAT_LABELS, EXPECTED_TIMELINE_LABELS, type AuctionFormat, type ExpectedTimeline } from "@/types/asset-posting";
import type { OrgMatchResult } from "@/lib/orgMatching";
import { AssetBriefEditor } from "../AssetBriefEditor";
import { Group, TextField, SelectField, WideRadio, Pill } from "../fields";
import { groupNumber, parseNumber, vnWords } from "../format";
import { OrgPicker } from "../OrgPicker";
import { buildBriefInput, buildMatchCriteria, toggleOrg, type WizardValues } from "../wizardSchema";

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

/** Nhãn nơi nhận cho ô soạn nội dung: một tên khi chọn một, còn lại là "N tổ chức". */
function recipientLabel(ids: string[], results: OrgMatchResult[]): string | null {
  if (ids.length === 0) return null;
  if (ids.length === 1) return results.find((r) => r.org.id === ids[0])?.org.name ?? null;
  return `${ids.length} tổ chức`;
}

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
            <WideRadio key={o.v} on={want === o.v} onClick={() => up({ wantsAuction: o.v as "yes" | "no", chosenOrgs: [] })}>
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
          {/* Khối này ĐỨNG TRƯỚC danh sách tổ chức vì cả 4 trường đều là ĐẦU VÀO
              chấm điểm khớp (buildMatchCriteria). Trước đây thù lao/thời gian nằm
              trong OptionalGroup đóng sẵn BÊN DƯỚI danh sách mà nó xếp hạng. */}
          <Group
            icon={<Tag className="h-4 w-4" />}
            title="Giá khởi điểm, hình thức & kỳ vọng"
            desc="Đây là căn cứ để sàn gợi ý tổ chức đấu giá phù hợp bên dưới"
          >
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-2">
                <label className="text-[13.5px] font-semibold text-foreground">
                  Cách xác định giá<span className="ml-0.5 text-destructive">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { v: "self", t: "Tôi tự đưa ra giá khởi điểm" },
                    { v: "appraisal", t: "Nhờ tổ chức đấu giá định giá" },
                  ].map((o) => (
                    <WideRadio
                      key={o.v}
                      on={f.pricingMode === o.v}
                      onClick={() => up({ pricingMode: o.v as "self" | "appraisal" })}
                      className="h-full"
                    >
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-[18px]">
                <TextField
                  label="Thù lao chấp nhận (tùy chọn)"
                  type="number"
                  unit="%"
                  placeholder="2"
                  help="Tổ chức chào thù lao cao hơn mức này sẽ bị xếp hạng thấp hơn."
                  value={f.commissionPct ?? ""}
                  onChange={(v) => up({ commissionPct: v })}
                />
                <SelectField
                  label="Thời gian kỳ vọng (tùy chọn)"
                  options={TIMELINES}
                  value={f.expectedTimeline ?? ""}
                  onChange={(v) => up({ expectedTimeline: v })}
                  placeholder="Chọn mốc thời gian"
                />
              </div>
            </div>
          </Group>

          <Group
            icon={<Clock className="h-4 w-4" />}
            title="Tổ chức đấu giá ký gửi"
            desc="Có thể quyết định sau khi số hoá"
            right={
              f.orgMode === "platform" ? (
                <Pill tone="ok">Nhờ sàn</Pill>
              ) : f.chosenOrgs.length > 0 ? (
                <Pill tone="ok">Đã chọn {f.chosenOrgs.length}</Pill>
              ) : null
            }
          >
            {/* 3 lựa chọn xếp ngang: đây là 3 lối đi ngang hàng nhau, xếp dọc khiến
                "Để quyết định sau" trông như phương án hạng hai. h-full cho 3 thẻ
                bằng chiều cao dù mô tả dài ngắn khác nhau. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {[
                {
                  v: "self",
                  t: "Tôi tự chọn tổ chức",
                  d: `So sánh và gửi yêu cầu báo giá tới tối đa ${MAX_RFQ_ORGS} tổ chức.`,
                },
                {
                  v: "platform",
                  t: "Nhờ sàn chọn giúp",
                  d: "Sàn gửi hồ sơ tới nhiều tổ chức, bạn so sánh báo giá rồi chọn.",
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
                  onClick={() => up({ orgMode: o.v as "" | "self" | "platform", chosenOrgs: [] })}
                  className="h-full"
                >
                  <span className="text-sm font-semibold text-foreground block">{o.t}</span>
                  <span className="text-xs text-muted-foreground block mt-0.5">{o.d}</span>
                </WideRadio>
              ))}
            </div>

            {f.orgMode === "self" && (
              <div className="mt-4 flex flex-col gap-3">
                {/* Người dùng đang sắp gửi hồ sơ tài sản của mình cho một doanh
                    nghiệp — phải nói trước điều đó dẫn tới đâu, có mất phí không,
                    có đổi được không. Trước đây bước này im lặng hoàn toàn. */}
                <ul className="flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[13px] text-foreground">
                  <li>
                    • Chọn được nhiều tổ chức (tối đa {MAX_RFQ_ORGS}). Khi hoàn tất số hoá, hồ sơ sẽ được gửi tới tất
                    cả tổ chức bạn chọn. Miễn phí.
                  </li>
                  <li>• Từng tổ chức xem hồ sơ rồi gửi báo giá thù lao, phí và thời gian để bạn so sánh.</li>
                  <li>• Đây chưa phải hợp đồng ký gửi — bạn chỉ chốt một tổ chức sau khi đã có báo giá.</li>
                </ul>
                <OrgPicker
                  results={orgResults}
                  criteria={buildMatchCriteria(f)}
                  isLoading={orgLoading}
                  selectedIds={f.chosenOrgs}
                  onToggle={(id) => up({ chosenOrgs: toggleOrg(f.chosenOrgs, id) })}
                  onSwitchToPlatform={() => up({ orgMode: "platform", chosenOrgs: [] })}
                />
                {/* Chỉ hiện sau khi đã chọn tổ chức: nhãn ô này gọi tên nơi nhận,
                    mà chưa chọn thì chưa có tên để gọi. */}
                {f.chosenOrgs.length > 0 && (
                  <div className="border-t border-border pt-3.5">
                    <AssetBriefEditor
                      input={buildBriefInput(f)}
                      recipientLabel={recipientLabel(f.chosenOrgs, orgResults)}
                      value={f.orgMessage ?? ""}
                      onChange={(v) => up({ orgMessage: v })}
                    />
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
        </>
      )}
    </div>
  );
}

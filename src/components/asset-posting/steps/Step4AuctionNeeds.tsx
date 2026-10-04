import { AlertCircle, Check, Landmark, Tag } from "lucide-react";
import { AUCTION_FORMAT_LABELS, EXPECTED_TIMELINE_LABELS, type AuctionFormat, type ExpectedTimeline } from "@/types/asset-posting";
import type { OrgMatchResult } from "@/lib/orgMatching";
import type { AuthenticationRequiredReason } from "@/types/authentication";
import { Group, TextField, SelectField, WideRadio } from "../fields";
import { groupNumber, parseNumber, vnWords } from "../format";
import { wantsAuctionPatch } from "../dossier/dossierWizard";
import type { WizardValues } from "../wizardSchema";
import { PostingAuctionConsultCard } from "@/components/auction-consult/PostingAuctionConsultCard";
import { AuthenticationGroup } from "./AuthenticationGroup";
import { ValuationGroup } from "./ValuationGroup";
import { AuctionSourceGroup } from "./AuctionSourceGroup";

interface StepProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  errs: Record<string, string>;
  orgResults: OrgMatchResult[];
  orgLoading: boolean;
  /** null khi hồ sơ chưa từng được lưu. */
  postingId: string | null;
  /** Tự lưu nháp khi đặt giám định. */
  ensurePostingId: () => Promise<string | null>;
  gdReasons: AuthenticationRequiredReason[];
  gdLotReason: string | null;
  /** Vai trò được gửi hồ sơ cho tổ chức / nhờ sàn (ky-gui:create). Mặc định có. */
  canConsign?: boolean;
}

const FORMATS = Object.keys(AUCTION_FORMAT_LABELS) as AuctionFormat[];
const TIMELINES = (Object.keys(EXPECTED_TIMELINE_LABELS) as ExpectedTimeline[]).map((v) => ({
  value: v,
  label: EXPECTED_TIMELINE_LABELS[v],
}));

/**
 * Bước 4: tư vấn đấu giá (banner) → quyết định đấu giá (có/chưa) → Thẩm định giá → Giám định
 * (mỗi dịch vụ: đối tác riêng / qua sàn) → nếu đấu giá: giá + hình thức → Tổ chức đấu giá (chỉ qua sàn).
 */
export function Step4AuctionNeeds({
  f,
  up,
  errs,
  orgResults,
  orgLoading,
  postingId,
  ensurePostingId,
  gdReasons,
  gdLotReason,
  canConsign = true,
}: StepProps) {
  const want = f.wantsAuction;

  return (
    <div className="flex flex-col gap-4">
      {/* Banner dịch vụ đầu bước (thiết kế v3) — tuỳ chọn, không chặn "Tiếp tục" /
          "Hoàn tất" (BR-CNS-04: đề xuất chỉ là gợi ý). Gửi yêu cầu tự lưu nháp. */}
      <PostingAuctionConsultCard
        variant="banner"
        postingId={postingId}
        mode="owner"
        resolvePostingId={ensurePostingId}
        prefill={{
          startingPrice: f.pricingMode === "self" ? Number(f.startingPrice) || null : null,
          auctionFormat: f.auctionFormat || null,
          expectedTimeline: f.expectedTimeline || null,
        }}
      />

      <Group icon={<Landmark className="h-4 w-4" />} title="Nhu cầu đấu giá">
        <label className="block text-[13.5px] font-semibold text-foreground mb-2">
          Bạn có muốn đưa tài sản này ra đấu giá?<span className="ml-0.5 text-destructive">*</span>
        </label>
        <div className="flex flex-col gap-2.5">
          {[
            { v: "yes", t: "Có — tôi muốn đấu giá", d: "Khai giá khởi điểm, hình thức và chọn tổ chức ký gửi." },
            { v: "no", t: "Chưa — chỉ số hoá & lưu hồ sơ", d: "Hồ sơ lưu trong “Tài sản của tôi”, gửi đấu giá sau." },
          ].map((o) => (
            <WideRadio key={o.v} on={want === o.v} onClick={() => up(wantsAuctionPatch(f, o.v as "yes" | "no"))}>
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
        {want === "yes" && !canConsign && (
          <p className="mt-2.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Vai trò của bạn chưa được gửi hồ sơ cho tổ chức đấu giá. Hồ sơ sẽ được lưu kèm thông tin đấu giá;
            người có quyền Ký gửi trong đơn vị gửi đi sau.
          </p>
        )}
      </Group>

      {/* Thẩm định giá ngay dưới quyết định đấu giá, TRƯỚC giá khởi điểm: giá trị của đối tác
          điền sẵn giá khởi điểm. Giám định bắt buộc chặn "Hoàn tất", không chặn "Tiếp tục" (BR-GD-03). */}
      <ValuationGroup f={f} up={up} postingId={postingId} ensurePostingId={ensurePostingId} />
      <AuthenticationGroup
        f={f}
        up={up}
        postingId={postingId}
        ensurePostingId={ensurePostingId}
        gdReasons={gdReasons}
        gdLotReason={gdLotReason}
      />

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
                  label="Thù lao chấp nhận"
                  type="number"
                  unit="%"
                  placeholder="2"
                  help="Tổ chức chào thù lao cao hơn mức này sẽ bị xếp hạng thấp hơn."
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
          </Group>

          <AuctionSourceGroup f={f} up={up} orgResults={orgResults} orgLoading={orgLoading} />
        </>
      )}
    </div>
  );
}

import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, Check } from "lucide-react";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from "@/types/asset-posting";
import { groupNumber } from "../format";
import { filled, type Requirement, type WizardValues } from "../wizardSchema";

interface StepReviewProps {
  f: WizardValues;
  jump: (step: number) => void;
  missing: Requirement[];
  chosenOrgName?: string | null;
}

const PARENT_NAME: Record<string, string> = Object.fromEntries(ASSET_CATEGORIES.map((c) => [c.slug, c.name]));
const CHILD_NAME: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((c) => c.children.map((ch) => [ch.slug, ch.name])),
);

/** Bước 5: xem lại toàn bộ hồ sơ, nhảy sửa từng khối, cảnh báo mục còn thiếu. */
export function StepReview({ f, jump, missing, chosenOrgName }: StepReviewProps) {
  const deltas = getDeltaFields(f.childSlug);
  const legal = (x: string) => (x === "yes" ? "Có" : x === "no" ? "Không" : "");

  const Blk = ({ step, title, children }: { step: number; title: string; children: ReactNode }) => {
    const ms = missing.filter((m) => m.step === step);
    return (
      <div className={`border rounded-xl bg-card overflow-hidden ${ms.length ? "border-warning/40" : "border-border"}`}>
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b border-border ${ms.length ? "bg-warning/5" : "bg-muted/20"}`}>
          <span className={`w-[19px] h-[19px] rounded-full grid place-items-center text-white shrink-0 ${ms.length ? "bg-warning" : "bg-success"}`}>
            {ms.length ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          </span>
          <h3 className="text-[13.5px] font-semibold text-foreground flex-1">{title}</h3>
          {ms.length > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30">Thiếu {ms.length}</span>
          )}
          <button type="button" onClick={() => jump(step)} className="text-[13px] font-semibold text-primary hover:bg-primary/5 rounded-lg px-2.5 py-1 transition">
            Sửa
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-4 gap-y-1 px-4 py-3.5 text-[13.5px]">{children}</div>
      </div>
    );
  };

  const V = ({ k, v }: { k: string; v?: string }) => (
    <>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className={v ? "font-medium text-foreground" : "font-semibold text-warning"}>{v || "Chưa nhập"}</div>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {missing.length > 0 && (
        <div className="flex gap-2.5 items-start rounded-xl bg-warning/10 border border-warning/30 px-3.5 py-3 text-[13px] text-foreground">
          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <b className="font-bold">Còn {missing.length} mục bắt buộc:</b> {missing.map((m) => m.label).join(" · ")}
          </div>
        </div>
      )}

      <Blk step={1} title="Loại tài sản">
        <V k="Nhóm" v={PARENT_NAME[f.parentSlug]} />
        <V k="Loại" v={CHILD_NAME[f.childSlug]} />
      </Blk>

      <Blk step={2} title="Thông tin & thông số">
        <V k="Tên tài sản" v={f.title} />
        <V k="Khu vực" v={[f.address, f.ward, f.district, f.province].filter(Boolean).join(", ")} />
        {deltas.map((d) => {
          const raw = f.deltaFields[d.key];
          const label = d.type === "select" ? d.options?.find((o) => o.value === raw)?.label : raw != null ? String(raw) : "";
          if (!(d.required || filled(raw))) return null;
          return <V key={d.key} k={d.label} v={label ? `${label}${d.unit ? " " + d.unit : ""}` : ""} />;
        })}
      </Blk>

      <Blk step={3} title="Pháp lý">
        <V k="Giấy tờ sở hữu" v={f.ownershipProofUrls.length ? `${f.ownershipProofUrls.length} tệp` : ""} />
        <V k="Tranh chấp" v={legal(f.hasDispute)} />
        <V k="Thế chấp" v={legal(f.hasMortgage)} />
        <V k="Kê biên" v={legal(f.isSeized)} />
      </Blk>

      <Blk step={4} title="Nhu cầu đấu giá">
        <V k="Muốn đấu giá" v={f.wantsAuction === "yes" ? "Có" : f.wantsAuction === "no" ? "Chưa — chỉ số hoá" : ""} />
        {f.wantsAuction === "yes" && (
          <>
            <V
              k="Giá khởi điểm"
              v={f.pricingMode === "self" ? (f.startingPrice ? `${groupNumber(f.startingPrice)} VNĐ` : "") : "Nhờ tổ chức định giá"}
            />
            <V k="Hình thức" v={AUCTION_FORMAT_LABELS[f.auctionFormat as AuctionFormat]} />
            <V k="Tổ chức ký gửi" v={chosenOrgName || "Chọn sau"} />
          </>
        )}
        <V k="Ảnh / tài liệu" v={`${f.imageUrls.length} ảnh · ${f.docUrls.length} tài liệu`} />
      </Blk>
    </div>
  );
}

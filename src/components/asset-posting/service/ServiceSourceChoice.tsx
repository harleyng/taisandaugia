import { AlertTriangle } from "lucide-react";
import type { DraftSource } from "@/lib/dossier/draft";
import { SOURCE_LABEL, type DossierKind } from "@/lib/dossier/types";
import { WideRadio } from "../fields";

export type ServiceSource = "external_partner" | "marketplace";

const DESC: Record<DossierKind, Record<ServiceSource, string>> = {
  legal: {
    external_partner: "Luật sư / công ty luật của bạn đã rà soát — nhập kết luận và văn bản ý kiến.",
    marketplace: "Chuyên gia pháp lý của sàn rà soát giấy tờ và trả checklist Đủ / Thiếu / Cần làm rõ.",
  },
  auction: {
    external_partner: "Bạn đã có tổ chức đấu giá — hồ sơ không gửi yêu cầu báo giá qua sàn.",
    marketplace: "Tìm tổ chức qua sàn (tự chọn hoặc nhờ sàn chọn giúp) và nhận tư vấn đấu giá.",
  },
  appraisal: {
    external_partner: "Đơn vị thẩm định giá của bạn — nhập giá trị và chứng thư thẩm định.",
    marketplace: "Đơn vị thẩm định giá đối tác của sàn khảo sát, định giá và cấp chứng thư.",
  },
  authentication: {
    external_partner: "Đơn vị giám định của bạn — nhập kết luận và chứng thư giám định.",
    marketplace: "Đặt giám định qua đối tác của sàn — chứng thư độc lập, tăng mức xác minh của lô.",
  },
};

interface ServiceSourceChoiceProps {
  kind: DossierKind;
  value: DraftSource;
  onChange: (v: ServiceSource) => void;
  /** Lý do khoá "Đối tác riêng" (vd. loại tài sản bắt buộc giám định qua sàn). */
  externalLockedReason?: string | null;
  disabled?: boolean;
}

/** 2 lựa chọn của một dịch vụ: "Đối tác riêng" · "Dịch vụ của sàn". Chưa chọn = chưa làm. */
export function ServiceSourceChoice({ kind, value, onChange, externalLockedReason, disabled }: ServiceSourceChoiceProps) {
  const opts: ServiceSource[] = ["external_partner", "marketplace"];
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {opts.map((o) => {
        const locked = o === "external_partner" && !!externalLockedReason;
        return (
          <WideRadio
            key={o}
            on={value === o}
            onClick={() => onChange(o)}
            disabled={disabled || locked}
            className="h-full"
          >
            <span className="block text-sm font-semibold text-foreground">{SOURCE_LABEL[o]}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {locked ? externalLockedReason : DESC[kind][o]}
            </span>
          </WideRadio>
        );
      })}
    </div>
  );
}

/** Cảnh báo phần "Đối tác riêng" còn thiếu trường bắt buộc (chưa được lưu). */
export function IncompletePartnerNote() {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
      <AlertTriangle className="h-3.5 w-3.5" /> Nhập đủ các trường có dấu * để lưu thông tin đối tác vào hồ sơ.
    </div>
  );
}

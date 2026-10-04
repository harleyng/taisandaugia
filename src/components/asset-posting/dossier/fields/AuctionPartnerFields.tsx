import type { AuctionDraft } from "@/lib/dossier/draft";
import { Field } from "../../fields";
import { OwnerPartnerSelect } from "../../partners/OwnerPartnerSelect";
import { DateField } from "./DateField";

interface AuctionPartnerFieldsProps {
  value: AuctionDraft;
  onChange: (patch: Partial<AuctionDraft>) => void;
  showErrors?: boolean;
  disabled?: boolean;
}

/**
 * "Đối tác riêng" — tổ chức đấu giá chủ đã thuê. Chọn trong đối tác của tôi hoặc danh bạ
 * tổ chức đấu giá (tự thêm vào đối tác của tôi); không có thì thêm đối tác mới.
 */
export function AuctionPartnerFields({ value: au, onChange, showErrors, disabled }: AuctionPartnerFieldsProps) {
  const missing = !au.partnerId && !au.partnerOrgId && !au.partnerName.trim();
  return (
    <div className="flex flex-col gap-4">
      <Field label="Tổ chức đấu giá" req err={showErrors && missing ? "Bắt buộc" : undefined}>
        <OwnerPartnerSelect
          kind="auction"
          partnerId={au.partnerId}
          partnerName={au.partnerName}
          onChange={(p) => onChange({ partnerId: p.id, partnerName: p.name, partnerOrgId: p.auction_org_id ?? "" })}
          invalid={!!showErrors && missing}
          disabled={disabled}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateField
          label="Ngày ký hợp đồng dịch vụ"
          value={au.contractDate}
          onChange={(v) => onChange({ contractDate: v })}
          disabled={disabled}
        />
        <DateField
          label="Ngày dự kiến đấu giá"
          value={au.plannedDate}
          onChange={(v) => onChange({ plannedDate: v })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

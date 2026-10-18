import { OptionTile } from "@/components/buyer-contracts/ui";
import type { BuyerKind } from "@/types/bidding-contract";
import { OrgBuyerFields } from "./OrgBuyerFields";
import { RegField } from "./RegField";
import { StepCard } from "./StepCard";
import type { StepProps } from "./types";

const KINDS: { value: BuyerKind; title: string; hint: string }[] = [
  { value: "individual", title: "Cá nhân", hint: "Tôi đứng tên hồ sơ" },
  {
    value: "organization",
    title: "Tổ chức / doanh nghiệp",
    hint: "Đứng tên công ty, người đại diện theo pháp luật ký hồ sơ",
  },
];

/** Bước 1 — ai đứng tên hồ sơ (cá nhân / tổ chức) + liên hệ của hồ sơ. */
export function BuyerKindStep(props: StepProps) {
  const { values, patch, errors, busy } = props;

  return (
    <StepCard title="Ai đứng tên hồ sơ?" sub="Người đứng tên là người nhận tài sản và ký hợp đồng nếu trúng đấu giá.">
      <div role="radiogroup" aria-label="Người đứng tên hồ sơ" className="grid gap-3 sm:grid-cols-2">
        {KINDS.map((k) => (
          <OptionTile
            key={k.value}
            selected={values.buyer_kind === k.value}
            title={k.title}
            hint={k.hint}
            disabled={busy}
            onSelect={() => patch({ buyer_kind: k.value })}
          />
        ))}
      </div>

      {values.buyer_kind === "organization" && <OrgBuyerFields {...props} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <RegField id="reg-phone" label="Số điện thoại liên hệ" inputMode="tel" placeholder="0912345678" value={values.phone}
          error={errors.root.phone} disabled={busy} onChange={(v) => patch({ phone: v })} />
        <RegField id="reg-email" label="Email nhận thông báo" inputMode="email" value={values.email} error={errors.root.email}
          disabled={busy} onChange={(v) => patch({ email: v })} />
      </div>
      <p className="text-xs text-muted-foreground">
        Kết quả duyệt hồ sơ và thông báo phiên được gửi qua số điện thoại và email này.
      </p>
    </StepCard>
  );
}

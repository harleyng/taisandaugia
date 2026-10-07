import { Building2, User } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { BuyerKind } from "@/types/bidding-contract";
import { OrgBuyerFields } from "./OrgBuyerFields";
import { RegField } from "./RegField";
import type { StepProps } from "./types";

const KINDS: { value: BuyerKind; title: string; hint: string; icon: typeof User }[] = [
  { value: "individual", title: "Cá nhân", hint: "Tôi đăng ký tham gia với tư cách cá nhân", icon: User },
  { value: "organization", title: "Tổ chức", hint: "Doanh nghiệp đăng ký, người đại diện theo pháp luật kê khai", icon: Building2 },
];

/** Bước 1 — ai đăng ký (cá nhân / tổ chức) + liên hệ của hồ sơ. */
export function BuyerKindStep(props: StepProps) {
  const { values, patch, errors, busy } = props;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Người đăng ký là <span className="text-destructive">*</span>
        </p>
        <RadioGroup
          value={values.buyer_kind}
          onValueChange={(v) => patch({ buyer_kind: v as BuyerKind })}
          className="grid gap-3 sm:grid-cols-2"
          disabled={busy}
        >
          {KINDS.map(({ value, title, hint, icon: Icon }) => (
            <label
              key={value}
              htmlFor={`reg-kind-${value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                values.buyer_kind === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              )}
            >
              <RadioGroupItem id={`reg-kind-${value}`} value={value} className="mt-1" />
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium text-foreground">{title}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {values.buyer_kind === "organization" && <OrgBuyerFields {...props} />}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Liên hệ</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <RegField id="reg-phone" label="Số điện thoại" inputMode="tel" placeholder="0912345678" value={values.phone}
            error={errors.root.phone} disabled={busy} onChange={(v) => patch({ phone: v })} />
          <RegField id="reg-email" label="Email" inputMode="email" value={values.email} error={errors.root.email}
            disabled={busy} onChange={(v) => patch({ email: v })} />
        </div>
        <p className="text-xs text-muted-foreground">Tổ chức đấu giá dùng số điện thoại và email này để liên hệ về hồ sơ.</p>
      </div>
    </div>
  );
}

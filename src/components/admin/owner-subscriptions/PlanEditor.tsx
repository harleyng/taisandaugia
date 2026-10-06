import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useOwnerSubBenefitCatalog } from "@/hooks/useOwnerSubscriptionPlans";
import { PlanCard } from "@/components/asset-owner-portal/subscription/PlanCard";
import { benefitLineValid } from "@/lib/ownerSubscription/benefits";
import { planTermPrice } from "@/lib/ownerSubscription/catalog";
import { type PlanDraft, blankPlanDraft, draftToOwnerPlan, termLabel, vndShort } from "@/lib/ownerSubscription/packages";
import { OVERAGE_HINTS } from "@/lib/ownerSubscription/status";
import type { OverageMode, PlanTier, SubTerm } from "@/lib/ownerSubscription/types";
import { BenefitLinesEditor } from "./BenefitLinesEditor";
import { TierSwatch } from "./PackageBits";
import { VndInput } from "./VndInput";

const TIERS: { key: PlanTier; label: string; hint: string }[] = [
  { key: "basic", label: "Cơ bản", hint: "Thẻ sáng" },
  { key: "standard", label: "Tiêu chuẩn", hint: "Thẻ xanh đậm" },
  { key: "premium", label: "Chuyên nghiệp", hint: "Thẻ vàng kim" },
];

const OVERAGES: { key: OverageMode; label: string }[] = [
  { key: "credits", label: "Trừ credit" },
  { key: "block", label: "Chặn" },
];

const Req = () => <span className="text-destructive">*</span>;

interface Props {
  /** null = thêm gói mới vào bộ. */
  plan: PlanDraft | null;
  packageName: string;
  /** Kỳ của bộ (chip giá theo kỳ). */
  terms: SubTerm[];
  featured: boolean;
  usingCount: number;
  canEdit: boolean;
  saving: boolean;
  onSave: (draft: PlanDraft) => void;
  onBack: () => void;
}

/** Trang sửa / thêm gói trong một bộ: thông tin thẻ, giá, quyền lợi, khi hết hạn mức + xem trước thẻ. */
export function PlanEditor({ plan, packageName, terms, featured, usingCount, canEdit, saving, onSave, onBack }: Props) {
  const [initial] = useState(() => plan ?? blankPlanDraft());
  const [d, setD] = useState<PlanDraft>(initial);
  const set = (patch: Partial<PlanDraft>) => setD((v) => ({ ...v, ...patch }));
  const { data: catalog = [], isLoading: catalogLoading } = useOwnerSubBenefitCatalog();
  const defs = useMemo(() => new Map(catalog.map((b) => [b.key, b])), [catalog]);

  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const nameOk = d.name.trim().length >= 2;
  const priceOk = d.monthly_price_vnd > 0;
  const benefitsOk = d.benefits.length > 0 && d.benefits.every((l) => benefitLineValid(l, defs.get(l.benefit_key)));
  const preview = draftToOwnerPlan(d, defs, featured);

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const back = () => {
    if (!dirty || window.confirm("Bỏ các thay đổi chưa lưu?")) onBack();
  };

  return (
    <div ref={rootRef} className="scroll-mt-4 space-y-4 p-6">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <button type="button" className="hover:text-foreground" onClick={back}>
          Danh mục gói
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <button type="button" className="hover:text-foreground" onClick={back}>
          {packageName || "Bộ gói mới"}
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{plan ? plan.name : "Thêm gói"}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {plan ? `Sửa gói ${plan.name}` : `Thêm gói vào bộ ${packageName || "mới"}`}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {plan?.id
              ? `${usingCount} tổ chức đang dùng giữ hạn mức cũ tới lần gia hạn sau.`
              : "Gói hiện với chủ tài sản sau khi bạn lưu bộ gói."}
          </p>
        </div>
        {plan && canEdit && (
          <Button variant="outline" onClick={() => set({ is_active: !d.is_active })}>
            {d.is_active ? "Ngừng bán gói này" : "Mở bán lại"}
          </Button>
        )}
      </div>

      {!d.is_active && (
        <div className="flex gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Gói sẽ ngừng bán sau khi lưu — ẩn khỏi trang Gói dịch vụ; {usingCount} tổ chức đang dùng chạy tới hết hạn nhưng không gia hạn được.
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="divide-y rounded-2xl border bg-card">
          <fieldset disabled={!canEdit} className="space-y-4 p-5">
            <h3 className="text-sm font-semibold text-foreground">Thông tin trên thẻ</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-name">Tên gói <Req /></Label>
                <Input id="plan-name" value={d.name} maxLength={60} placeholder="VD: Chi nhánh cấp 2" onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-fit">Phù hợp với</Label>
                <Input id="plan-fit" value={d.fit_line} maxLength={120} onChange={(e) => set({ fit_line: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="plan-hl">Câu nổi bật</Label>
                <Input id="plan-hl" value={d.highlight_line} maxLength={120} onChange={(e) => set({ highlight_line: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Kiểu thẻ <Req /></Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {TIERS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={d.tier === t.key}
                    onClick={() => set({ tier: t.key })}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left",
                      d.tier === t.key ? "border-primary bg-primary/5" : "border-input hover:border-primary/50",
                    )}
                  >
                    <TierSwatch tier={t.key} className="h-7" />
                    <span>
                      <b className="block text-sm text-foreground">{t.label}</b>
                      <span className="block text-xs text-muted-foreground">{t.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset disabled={!canEdit} className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Giá <span className="font-normal text-muted-foreground">· chưa VAT · kỳ lấy theo bộ gói</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="plan-price">Giá mỗi tháng <Req /></Label>
                <VndInput id="plan-price" value={d.monthly_price_vnd} onChange={(v) => set({ monthly_price_vnd: v })} />
              </div>
              <div className="flex flex-wrap gap-2">
                {terms.length ? (
                  terms.map((t) => (
                    <div key={t.id} className="rounded-lg bg-muted px-3 py-1.5">
                      <div className="text-[11px] text-muted-foreground">{termLabel(t)}</div>
                      <div className="text-sm font-semibold tabular-nums text-foreground">
                        {d.monthly_price_vnd ? vndShort(planTermPrice(d.monthly_price_vnd, t.months, t.discount_pct)) : "—"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Bộ chưa chọn kỳ mua</div>
                )}
              </div>
            </div>
          </fieldset>

          <fieldset disabled={!canEdit} className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Quyền lợi <Req /> <span className="font-normal text-muted-foreground">· {d.benefits.length} dòng</span>
            </h3>
            {catalogLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải danh mục quyền lợi…
              </div>
            ) : (
              <BenefitLinesEditor value={d.benefits} onChange={(benefits) => set({ benefits })} catalog={catalog} disabled={!canEdit} />
            )}
          </fieldset>

          <fieldset disabled={!canEdit} className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Khi hết hạn mức <Req /> <span className="font-normal text-muted-foreground">· áp cho quyền lợi hệ thống kiểm</span>
            </h3>
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
              {OVERAGES.map((o) => {
                const on = d.overage_mode === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ overage_mode: o.key })}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left",
                      on ? "border-primary bg-primary/5" : "border-input hover:border-primary/50",
                    )}
                  >
                    <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-[1.5px]", on ? "border-primary" : "border-input")}>
                      {on && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span>
                      <b className="block text-sm text-foreground">{o.label}</b>
                      <span className="block text-xs text-muted-foreground">{OVERAGE_HINTS[o.key]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Xem trước thẻ gói</div>
          <PlanCard
            plan={preview}
            prev={null}
            months={1}
            discountPct={0}
            tag={featured ? "Phổ biến nhất" : null}
            cta={{ label: `Đăng ký ${preview.name}`, tone: d.tier === "premium" ? "gold" : "solid", disabled: false }}
            locked
            lockedHint="Bản xem trước"
            onSelect={() => undefined}
          />
          <div className="space-y-2 rounded-2xl border bg-card p-4">
            {(
              [
                [nameOk, "Tên gói"],
                [priceOk, "Giá mỗi tháng"],
                [benefitsOk, "Quyền lợi hợp lệ"],
              ] as [boolean, string][]
            ).map(([ok, label]) => (
              <div key={label} className={cn("flex items-center gap-2 text-sm", ok ? "text-foreground" : "text-muted-foreground")}>
                <span className={cn("grid h-4 w-4 place-items-center rounded-full", ok ? "bg-success text-primary-foreground" : "border border-input")}>
                  {ok && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
                {label}
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              {canEdit && (
                <Button className="flex-1" disabled={!dirty || !(nameOk && priceOk && benefitsOk) || saving} onClick={() => onSave(d)}>
                  {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  {plan ? "Lưu gói" : "Thêm vào bộ"}
                </Button>
              )}
              <Button variant="outline" className="flex-1" onClick={back}>
                {canEdit ? "Huỷ" : "Quay lại"}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

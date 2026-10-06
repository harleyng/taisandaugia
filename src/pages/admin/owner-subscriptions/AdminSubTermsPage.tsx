import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useAdminSubCatalog, useDeleteTerm, useSaveTerm } from "@/hooks/useAdminOwnerSubscriptions";
import { SubAdminHeader } from "@/components/admin/owner-subscriptions/SubAdminHeader";
import { planTermPrice } from "@/lib/ownerSubscription/catalog";
import { type TermInput, sortTerms, termInputError, vndShort } from "@/lib/ownerSubscription/packages";
import type { SubTerm } from "@/lib/ownerSubscription/types";

const GRID =
  "grid items-center gap-x-4 gap-y-2 px-[18px] text-[13.5px] grid-cols-2 md:grid-cols-[110px_100px_minmax(0,1.2fr)_minmax(0,1.6fr)_120px_140px]";
const EXAMPLE_PRICE = 5_000_000;
const EMPTY: TermInput = { months: "", discount: "", note: "" };

const toInput = (t: SubTerm): TermInput => ({ months: String(t.months), discount: String(t.discount_pct), note: t.note ?? "" });

/** /admin/goi-thue-bao/ky-mua — thư viện kỳ mua dùng chung; mỗi bộ gói chọn kỳ riêng từ đây. */
export default function AdminSubTermsPage() {
  const { data, isLoading } = useAdminSubCatalog();
  const canCreate = useHasAdminPermission("goi-thue-bao", "create");
  const canUpdate = useHasAdminPermission("goi-thue-bao", "update");
  const saveTerm = useSaveTerm();
  const deleteTerm = useDeleteTerm();
  const [edit, setEdit] = useState<{ id: string; value: TermInput } | null>(null);
  const [draft, setDraft] = useState<TermInput>(EMPTY);

  const library = data?.terms ?? [];
  const usedBy = (id: string) => (data?.packages ?? []).filter((k) => k.term_ids.includes(id));
  const save = (id: string | null, v: TermInput, done: () => void) =>
    saveTerm.mutate({ id, months: Number(v.months), discountPct: Number(v.discount), note: v.note }, { onSuccess: done });

  // Ô chiết khấu để trống = 0 %.
  const draftValue = { ...draft, discount: draft.discount || "0" };
  const draftError = draft.months || draft.discount ? termInputError(draftValue, library, null) : null;

  return (
    <div>
      <SubAdminHeader
        section="terms"
        title="Kỳ mua & chiết khấu"
        description="Thư viện kỳ mua dùng chung. Mỗi bộ gói chọn các kỳ riêng từ đây — ngân hàng có thể dùng kỳ 12 tháng −15% trong khi đại trà dùng −10%."
      />
      <div className="p-6">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className={cn(GRID, "hidden bg-muted/40 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground md:grid")}>
            <span>Kỳ</span>
            <span className="text-right">Chiết khấu</span>
            <span>Ghi chú</span>
            <span>Dùng trong bộ gói</span>
            <span className="text-right">VD gói 5 tr/tháng</span>
            <span />
          </div>
          {isLoading && (
            <div className="border-t p-4">
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {sortTerms(library).map((t) => {
            const used = usedBy(t.id);
            if (edit?.id === t.id) {
              const err = termInputError(edit.value, library, t.id);
              const patch = (p: Partial<TermInput>) => setEdit({ id: t.id, value: { ...edit.value, ...p } });
              return (
                <div key={t.id} className={cn(GRID, "border-t bg-primary/5 py-2.5")}>
                  <UnitInput label="Số tháng" unit="tháng" value={edit.value.months} onChange={(months) => patch({ months })} />
                  <UnitInput label="Chiết khấu" unit="%" step="0.5" value={edit.value.discount} onChange={(discount) => patch({ discount })} right />
                  <Input aria-label="Ghi chú" className="h-9" value={edit.value.note} maxLength={120} placeholder="Ghi chú nội bộ" onChange={(e) => patch({ note: e.target.value })} />
                  <span className="text-xs text-muted-foreground md:col-span-2">
                    {used.length > 0 && `Áp dụng cho ${used.length} bộ gói từ lần mua / gia hạn sau.`}
                    {err && <span className="text-destructive"> {err}</span>}
                  </span>
                  <span className="col-span-2 flex justify-end gap-1 md:col-span-1">
                    <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
                      Huỷ
                    </Button>
                    <Button size="sm" disabled={!!err || saveTerm.isPending} onClick={() => save(t.id, edit.value, () => setEdit(null))}>
                      Lưu
                    </Button>
                  </span>
                </div>
              );
            }
            return (
              <div key={t.id} className={cn(GRID, "border-t py-2.5")}>
                <span className="font-semibold">{t.months} tháng</span>
                <span className="text-right font-semibold tabular-nums">{t.discount_pct ? `−${t.discount_pct}%` : "—"}</span>
                <span className="text-[12.5px] text-muted-foreground">{t.note || "—"}</span>
                <span className="flex flex-wrap gap-1.5">
                  {used.length ? (
                    used.map((k) => (
                      <span key={k.id} className="rounded-md border px-2 py-0.5 text-xs font-semibold">
                        {k.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[12.5px] text-muted-foreground">Chưa dùng</span>
                  )}
                </span>
                <span className="text-right tabular-nums">{vndShort(planTermPrice(EXAMPLE_PRICE, t.months, t.discount_pct))}</span>
                <span className="col-span-2 flex justify-end gap-1 md:col-span-1">
                  {canUpdate && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEdit({ id: t.id, value: toInput(t) })}>
                        Sửa
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={used.length > 0 || deleteTerm.isPending}
                        title={used.length ? "Đang dùng trong bộ gói — bỏ khỏi bộ trước khi xoá" : undefined}
                        onClick={() => deleteTerm.mutate(t.id)}
                      >
                        Xoá
                      </Button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {canCreate && (
            <div className={cn(GRID, "border-t bg-muted/40 py-2.5")}>
              <UnitInput label="Số tháng" unit="tháng" placeholder="12" value={draft.months} onChange={(months) => setDraft({ ...draft, months })} />
              <UnitInput label="Chiết khấu" unit="%" step="0.5" placeholder="0" value={draft.discount} onChange={(discount) => setDraft({ ...draft, discount })} right />
              <Input aria-label="Ghi chú" className="h-9" value={draft.note} maxLength={120} placeholder="Ghi chú nội bộ" onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              <span className="text-xs md:col-span-2">
                {draftError ? (
                  <span className="text-destructive">{draftError}</span>
                ) : (
                  <span className="text-muted-foreground">Kỳ 1–36 tháng, chiết khấu 0–50%. Giá kỳ làm tròn nghìn đồng.</span>
                )}
              </span>
              <span className="col-span-2 flex justify-end md:col-span-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!draft.months || !!draftError || saveTerm.isPending}
                  onClick={() => save(null, draftValue, () => setDraft(EMPTY))}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Thêm kỳ
                </Button>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface UnitInputProps {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
  right?: boolean;
}

function UnitInput({ label, unit, value, onChange, placeholder, step, right }: UnitInputProps) {
  return (
    <span className={cn("flex items-center gap-1.5", right && "md:justify-end")}>
      <Input
        aria-label={label}
        type="number"
        step={step}
        className="h-9 w-20 tabular-nums"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="text-xs text-muted-foreground">{unit}</span>
    </span>
  );
}

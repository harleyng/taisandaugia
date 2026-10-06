import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { type PlanDraft, planQuotaCell } from "@/lib/ownerSubscription/packages";
import { TierSwatch } from "./PackageBits";

const GRID =
  "grid items-center gap-x-3.5 gap-y-1 grid-cols-[22px_minmax(0,1fr)_auto] md:grid-cols-[22px_minmax(200px,2fr)_minmax(0,1fr)_80px_90px_minmax(0,1fr)_64px_70px]";

interface Props {
  plans: PlanDraft[];
  featuredKey: string | null;
  /** Số Trạm đang dùng từng gói (theo id). */
  usingCount: (planId: string | null) => number;
  canEdit: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onFeatured: (key: string | null) => void;
  onEdit: (key: string) => void;
  onAdd: () => void;
}

/** Thẻ "Gói trong bộ": thứ tự = thứ tự hiển thị, chọn gói "Phổ biến", mở trang sửa gói. */
export function PackagePlansTable({ plans, featuredKey, usingCount, canEdit, onMove, onFeatured, onEdit, onAdd }: Props) {
  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3.5">
        <h2 className="text-base font-semibold text-foreground">Gói trong bộ</h2>
        <span className="flex-1 text-xs text-muted-foreground">{plans.length} gói · thứ tự = thứ tự hiển thị</span>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Thêm gói
          </Button>
        )}
      </div>
      <div className="p-5 pt-3">
        {plans.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center">
            <div className="font-semibold text-foreground">Bộ chưa có gói</div>
            <p className="text-sm text-muted-foreground">Thêm ít nhất một gói — ví dụ ba mức Cơ bản / Tiêu chuẩn / Chuyên nghiệp.</p>
            {canEdit && (
              <Button className="mt-1" onClick={onAdd}>
                <Plus className="mr-1.5 h-4 w-4" /> Thêm gói đầu tiên
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className={cn(GRID, "hidden bg-muted/40 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid")}>
              <span />
              <span>Gói</span>
              <span className="text-right">Giá / tháng</span>
              <span className="text-right">Quét 3D</span>
              <span className="text-right">Báo cáo DM</span>
              <span>Hết hạn mức</span>
              <span>Phổ biến</span>
              <span />
            </div>
            {plans.map((p, i) => {
              const featured = featuredKey === p.key;
              return (
                <div key={p.key} className={cn(GRID, "border-t px-3.5 py-2.5 first:border-t-0 md:first:border-t")}>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label={`Đưa ${p.name} lên`}
                      disabled={!canEdit || i === 0}
                      onClick={() => onMove(i, -1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Đưa ${p.name} xuống`}
                      disabled={!canEdit || i === plans.length - 1}
                      onClick={() => onMove(i, 1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className={cn("flex min-w-0 items-center gap-2.5", !p.is_active && "opacity-55")}>
                    <TierSwatch tier={p.tier} className="h-7" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                        {p.name}
                        {!p.is_active && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Ngừng bán</span>
                        )}
                        {!p.id && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">Chưa lưu</span>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.fit_line ? `${p.fit_line} · ` : ""}
                        {usingCount(p.id)} đang dùng
                      </div>
                    </div>
                  </div>
                  <span className={cn("hidden whitespace-nowrap text-right tabular-nums md:block", !p.is_active && "opacity-55")}>
                    {formatMoneyFull(p.monthly_price_vnd)}
                  </span>
                  <span className={cn("hidden text-right tabular-nums md:block", !p.is_active && "opacity-55")}>
                    {planQuotaCell(p, "scan_3d_owner")}
                  </span>
                  <span className={cn("hidden text-right tabular-nums md:block", !p.is_active && "opacity-55")}>
                    {planQuotaCell(p, "report_portfolio_owner")}
                  </span>
                  <span className="hidden md:block">
                    <span
                      className={cn(
                        "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                        p.overage_mode === "block" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
                      )}
                    >
                      {p.overage_mode === "block" ? "Chặn" : "Trừ credit"}
                    </span>
                  </span>
                  <span className="hidden md:block">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={featured}
                      aria-label={`Đặt ${p.name} là gói phổ biến`}
                      disabled={!canEdit || !p.is_active}
                      onClick={() => onFeatured(featured ? null : p.key)}
                      className={cn(
                        "grid h-4 w-4 place-items-center rounded-full border-[1.5px] bg-card disabled:opacity-40",
                        featured ? "border-accent" : "border-input",
                      )}
                    >
                      {featured && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </button>
                  </span>
                  <Button size="sm" variant="ghost" className="justify-self-end" onClick={() => onEdit(p.key)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> {canEdit ? "Sửa" : "Xem"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

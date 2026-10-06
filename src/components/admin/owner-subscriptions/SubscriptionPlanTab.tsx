import { useNavigate } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminSubDetail } from "@/hooks/useAdminOwnerSubscriptions";
import { benefitValueText } from "@/lib/ownerSubscription/benefits";
import { OVERAGE_LABELS, formatSubDate } from "@/lib/ownerSubscription/status";
import type { AdminSubPackage, OwnerSubPlan } from "@/lib/ownerSubscription/types";
import { formatMoneyFull } from "@/utils/money";

interface Props {
  detail: AdminSubDetail;
  /** Bộ gói Trạm đang thấy (bộ được gán, chưa gán thì bộ mặc định). */
  pkg: AdminSubPackage | null;
  /** Mọi gói của bộ (kể cả gói đã ngừng bán). */
  allowedPlans: OwnerSubPlan[];
}

/**
 * Gói của Trạm — CHỈ ĐỌC. Cấu hình gói nằm ở danh mục; ở đây xem hạn mức đã chép vào
 * Trạm (giữ nguyên tới lần gia hạn sau) và các gói trong bộ gói của Trạm.
 */
export function SubscriptionPlanTab({ detail, pkg, allowedPlans }: Props) {
  const navigate = useNavigate();
  const { sub, status } = detail;
  const lines = status?.lines ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Gói đang áp dụng</h3>
        {sub ? (
          <div className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <Field label="Gói" value={sub.plan_name} />
              <Field label="Giá kỳ gần nhất" value={`${formatMoneyFull(sub.price_vnd)} · ${sub.term_months} tháng`} />
              <Field label="Khi hết hạn mức" value={OVERAGE_LABELS[sub.overage_mode]} />
            </div>
            <div>
              <div className="mb-1.5 text-xs text-muted-foreground">Quyền lợi đang áp</div>
              {lines.length ? (
                <ul className="divide-y rounded-xl border text-sm">
                  {lines.map((l) => (
                    <li key={l.benefit_key} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-foreground">
                        {l.label}
                        {l.source === "enforced" && <span className="ml-2 text-xs text-primary">Hệ thống kiểm</span>}
                      </span>
                      <span className="text-right tabular-nums text-muted-foreground">{benefitValueText(l)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Gói chưa có quyền lợi nào.</p>
              )}
            </div>
            {!status?.plan_id && (
              <p className="rounded-xl bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
                Gói riêng tạo theo cách cũ (không thuộc danh mục). Lần kích hoạt / gia hạn tới phải chọn một gói trong danh mục.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Sửa gói trong danh mục không đổi hạn mức đang áp — Trạm nhận cấu hình mới từ lần mua / gia hạn sau.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Trạm chưa có gói. Trưởng đơn vị tự mua trong các gói của bộ bên dưới, hoặc bấm "Kích hoạt tay".
          </p>
        )}
        {status?.pending && (
          <p className="mt-4 rounded-xl bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
            Đã thanh toán đổi sang gói <span className="font-semibold text-foreground">{status.pending.plan_name}</span>{" "}
            ({status.pending.months} tháng · {formatMoneyFull(status.pending.price_vnd)}) — tự áp dụng từ{" "}
            {formatSubDate(status.pending.from)}.
          </p>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Bộ gói: {pkg?.name ?? "—"}</h3>
            <p className="text-xs text-muted-foreground">
              {pkg?.is_default ? "Bộ mặc định — Trạm chưa được gán bộ riêng." : "Bộ được gán riêng cho Trạm."}
              {pkg && !pkg.is_active && " Bộ đang ngừng bán — Trạm không mua / gia hạn được."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(pkg ? `/admin/goi-thue-bao/danh-muc/${pkg.id}` : "/admin/goi-thue-bao/danh-muc")}
          >
            <LayoutGrid className="mr-1.5 h-4 w-4" /> {pkg ? "Mở bộ gói" : "Danh mục gói"}
          </Button>
        </div>
        {allowedPlans.length ? (
          <ul className="divide-y rounded-xl border text-sm">
            {allowedPlans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-medium text-foreground">
                  {p.name}
                  {!p.is_active && <span className="ml-2 text-xs font-normal text-muted-foreground">(ngừng bán)</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">{formatMoneyFull(p.monthly_price_vnd)} / tháng</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Bộ gói chưa có gói nào — Trưởng đơn vị không thấy gói nào. Thêm gói ở trang bộ gói, hoặc gán Trạm vào bộ khác.
          </p>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}

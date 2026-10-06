import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AdminOwnerSubRow, AdminSubPackage } from "@/lib/ownerSubscription/types";
import { CheckBox } from "./PackageTermsCard";

type Filter = "all" | "on" | "off";

interface Props {
  /** null khi đang tạo bộ mới. */
  packageId: string | null;
  selected: string[];
  /** Trạm của bộ lúc mở trang (để biết thêm / gỡ / chuyển). */
  baseSelected: string[];
  /** Id các gói của bộ (Trạm đang dùng gói này mà bị gỡ ⇒ không gia hạn được). */
  planIds: string[];
  rows: AdminOwnerSubRow[];
  packages: AdminSubPackage[];
  canEdit: boolean;
  onChange: (workspaceIds: string[]) => void;
}

/** Chọn tổ chức được dùng bộ: mỗi Trạm thấy đúng một bộ; chọn Trạm ở bộ khác ⇒ chuyển sang bộ này. */
export function PackageOrgPicker({ packageId, selected, baseSelected, planIds, rows, packages, canEdit, onChange }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const sel = useMemo(() => new Set(selected), [selected]);
  const base = useMemo(() => new Set(baseSelected), [baseSelected]);
  const plans = useMemo(() => new Set(planIds), [planIds]);
  const pkgName = (id: string | null) => packages.find((k) => k.id === id)?.name ?? "—";

  const running = (r: AdminOwnerSubRow) => r.status === "active" || r.status === "scheduled";
  const risk = rows.filter((r) => !sel.has(r.workspace_id) && base.has(r.workspace_id) && r.plan_id && plans.has(r.plan_id) && running(r));
  const s = q.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (!s || `${r.workspace_name} ${r.owner_name ?? ""} ${r.parent_name ?? ""}`.toLowerCase().includes(s)) &&
      (filter === "all" || (filter === "on") === sel.has(r.workspace_id)),
  );

  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(rows.filter((r) => next.has(r.workspace_id)).map((r) => r.workspace_id));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">
        Mỗi tổ chức thấy đúng một bộ gói. Chọn tổ chức đang ở bộ khác sẽ chuyển họ sang bộ này; gỡ thì họ về bộ mặc định.
      </p>
      {risk.length > 0 && (
        <div className="flex gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <b>{risk.length} tổ chức đang dùng gói của bộ này</b> sẽ bị gỡ ({risk.map((r) => r.workspace_name).join(", ")}) — gói chạy
            tới hết hạn nhưng không gia hạn được.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm tổ chức…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["all", "Tất cả"],
              ["on", `Đã chọn ${sel.size}`],
              ["off", "Chưa chọn"],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium",
                filter === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-xl border">
        {visible.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Không có tổ chức nào khớp.</div>}
        {visible.map((r) => {
          const on = sel.has(r.workspace_id);
          const was = base.has(r.workspace_id);
          const fromOther = r.assigned_package_id && r.assigned_package_id !== packageId;
          const atRisk = risk.includes(r);
          return (
            <button
              key={r.workspace_id}
              type="button"
              disabled={!canEdit}
              onClick={() => toggle(r.workspace_id)}
              className={cn(
                "grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 border-t px-3.5 py-2.5 text-left first:border-t-0 disabled:cursor-default",
                atRisk ? "bg-destructive/5" : "hover:bg-muted/40",
              )}
            >
              <CheckBox on={on} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{r.workspace_name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.owner_name || "—"} · đang ở bộ {pkgName(r.package_id)}
                  {r.plan_name ? ` · dùng ${r.plan_name}` : ""}
                </div>
              </div>
              <span className="text-xs font-semibold">
                {on && !was && <span className="text-primary">{fromOther ? `Chuyển từ ${pkgName(r.assigned_package_id)}` : "+ Thêm"}</span>}
                {!on && was && <span className="text-destructive">− Gỡ về mặc định</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

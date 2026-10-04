import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOwnerSubscriptionList } from "@/hooks/useAdminOwnerSubscriptions";
import { SubscriptionStatusBadge } from "@/components/owner-subscription/SubscriptionStatusBadge";
import { formatSubDate } from "@/lib/ownerSubscription/status";
import { formatMoneyFull } from "@/utils/money";
import type { AdminOwnerSubRow, SubStatus } from "@/lib/ownerSubscription/types";

type Filter = "all" | "none" | SubStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "active", label: "Đang hiệu lực" },
  { key: "expired", label: "Hết hạn" },
  { key: "cancelled", label: "Đã huỷ" },
  { key: "none", label: "Chưa có gói" },
];

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
    active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground",
  ].join(" ");

const matches = (row: AdminOwnerSubRow, f: Filter) => {
  if (f === "all") return true;
  if (f === "none") return !row.subscription_id;
  if (f === "active") return row.status === "active" || row.status === "scheduled";
  return row.status === f;
};

/** /admin/goi-thue-bao/ap-dung — mọi Trạm tổ chức chủ tài sản và gói thuê bao của từng Trạm. */
export default function AdminOwnerSubscriptionsPage() {
  const navigate = useNavigate();
  const { data: rows, isLoading } = useAdminOwnerSubscriptionList();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f.key] = (rows ?? []).filter((r) => matches(r, f.key)).length;
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (!matches(r, filter)) return false;
      if (!q) return true;
      return [r.workspace_name, r.owner_name, r.owner_email, r.code, r.plan_name, r.parent_name]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, filter]);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Áp dụng gói</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gói theo kỳ cho tổ chức chủ tài sản thay cho credit. Sàn tạo gói trong danh mục rồi chọn tổ chức được dùng; Trạm tự mua gói đã mở cho mình, hoặc sàn kích hoạt tay. Chủ tài sản cá nhân vẫn dùng credit.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={pill(filter === f.key)}>
              {f.label} ({counts[f.key] ?? 0})
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-sm sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tổ chức, Trưởng đơn vị, mã gói…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tổ chức (Trạm)</th>
              <th className="px-4 py-3 font-medium">Trưởng đơn vị</th>
              <th className="px-4 py-3 font-medium">Gói</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Hiệu lực</th>
              <th className="px-4 py-3 text-right font-medium">Giá / kỳ</th>
              <th className="px-4 py-3 text-right font-medium">Gói được dùng</th>
              <th className="w-8 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td colSpan={8} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Không có Trạm nào khớp bộ lọc.</td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.workspace_id}
                className="cursor-pointer border-t hover:bg-muted/30"
                onClick={() => navigate(`/admin/goi-thue-bao/ap-dung/${r.workspace_id}`)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{r.workspace_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.member_count} thành viên{r.parent_name ? ` · chi nhánh của ${r.parent_name}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{r.owner_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.owner_email}</div>
                </td>
                <td className="px-4 py-3">
                  {r.subscription_id ? (
                    <>
                      <div>{r.plan_name}</div>
                      <div className="text-xs text-muted-foreground">{r.code} · {r.term_months} tháng/kỳ</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3"><SubscriptionStatusBadge status={r.status} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {r.starts_on ? `${formatSubDate(r.starts_on)} – ${formatSubDate(r.ends_on)}` : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {r.subscription_id ? formatMoneyFull(r.price_vnd) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.allowed_plan_ids?.length ? r.allowed_plan_ids.length : <span className="text-muted-foreground">0</span>}
                </td>
                <td className="px-2 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

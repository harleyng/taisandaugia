import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useAdminOwnerSubscriptionList, useAdminSubCatalog } from "@/hooks/useAdminOwnerSubscriptions";
import { SubAdminHeader } from "@/components/admin/owner-subscriptions/SubAdminHeader";
import { DefaultTag, SellBadge, TierSwatch } from "@/components/admin/owner-subscriptions/PackageBits";
import { packagePriceRange, packageStats, packageTerms, termChip } from "@/lib/ownerSubscription/packages";

type Tab = "active" | "issues" | "inactive" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "active", label: "Đang bán" },
  { key: "issues", label: "Cần xử lý" },
  { key: "inactive", label: "Ngừng bán" },
  { key: "all", label: "Tất cả" },
];

const GRID =
  "grid gap-x-5 gap-y-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_16px] lg:items-center";

/** /admin/goi-thue-bao/danh-muc — danh sách bộ gói (mỗi bộ = nhiều gói × kỳ riêng, gán cho tổ chức). */
export default function AdminOwnerSubPlansPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useAdminSubCatalog();
  const { data: rows = [] } = useAdminOwnerSubscriptionList();
  const canCreate = useHasAdminPermission("goi-thue-bao", "create");
  const [tab, setTab] = useState<Tab>("active");
  const [q, setQ] = useState("");

  const packages = useMemo(() => data?.packages ?? [], [data?.packages]);
  const stats = useMemo(() => new Map(packages.map((k) => [k.id, packageStats(k, rows)])), [packages, rows]);
  const counts: Record<Tab, number> = {
    active: packages.filter((k) => k.is_active).length,
    issues: packages.filter((k) => stats.get(k.id)!.issues.length).length,
    inactive: packages.filter((k) => !k.is_active).length,
    all: packages.length,
  };
  const s = q.trim().toLowerCase();
  const visible = packages.filter(
    (k) =>
      (tab === "all" || (tab === "issues" ? stats.get(k.id)!.issues.length > 0 : (tab === "active") === k.is_active)) &&
      (!s || [k.name, k.description ?? "", ...k.plans.map((p) => p.name)].join(" ").toLowerCase().includes(s)),
  );

  return (
    <div>
      <SubAdminHeader
        section="catalog"
        title="Danh mục gói"
        description="Mỗi bộ gói gồm các gói và kỳ mua riêng. Tổ chức được gán vào một bộ; chưa gán thì thấy bộ mặc định."
        actions={
          canCreate && (
            <Button onClick={() => navigate("/admin/goi-thue-bao/danh-muc/moi")}>
              <Plus className="mr-1.5 h-4 w-4" /> Thêm bộ gói
            </Button>
          )
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-bold leading-[17px]",
                    t.key === "issues" && counts.issues
                      ? "bg-warning/15 text-warning"
                      : tab === t.key
                        ? "bg-primary/10 text-primary"
                        : "bg-background text-muted-foreground",
                  )}
                >
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Tìm bộ gói, tên gói…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className={cn(GRID, "hidden bg-muted/40 px-[18px] py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid")}>
            <span>Bộ gói</span>
            <span>Gói trong bộ</span>
            <span>Kỳ mua</span>
            <span>Tổ chức</span>
            <span>Trạng thái</span>
            <span />
          </div>
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-t px-[18px] py-4">
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          {!isLoading && visible.length === 0 && (
            <div className="border-t px-4 py-12 text-center text-sm text-muted-foreground">Không có bộ gói nào khớp.</div>
          )}
          {visible.map((k) => {
            const st = stats.get(k.id)!;
            const terms = packageTerms(k.term_ids, data?.terms ?? []);
            return (
              <div
                key={k.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/goi-thue-bao/danh-muc/${k.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/admin/goi-thue-bao/danh-muc/${k.id}`)}
                className={cn(GRID, "cursor-pointer border-t px-[18px] py-3.5 hover:bg-primary/[0.03]")}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[14.5px] font-bold text-foreground">
                    {k.name}
                    {k.is_default && <DefaultTag />}
                  </div>
                  {k.description && <div className="text-[12.5px] leading-snug text-muted-foreground">{k.description}</div>}
                </div>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    {k.plans.map((p) => (
                      <span
                        key={p.id}
                        className={cn(
                          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border py-0.5 pl-1.5 pr-2 text-xs font-semibold",
                          !p.is_active && "text-muted-foreground line-through",
                        )}
                      >
                        <TierSwatch tier={p.tier} />
                        {p.name}
                      </span>
                    ))}
                  </div>
                  <div className="text-[12.5px] tabular-nums text-muted-foreground">{packagePriceRange(k)} / tháng</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {terms.length ? (
                    terms.map((t) => (
                      <span key={t.id} className="whitespace-nowrap rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
                        {termChip(t)}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">Chưa chọn</span>
                  )}
                </div>
                <div className="text-[13px] text-muted-foreground">
                  {k.is_default ? (
                    <>
                      <div>
                        Tổ chức chưa gán · <b className="text-foreground">{st.members.length}</b>
                      </div>
                      <div className="text-[12.5px]">
                        <b className="text-foreground">{st.using.length}</b> đang dùng
                      </div>
                    </>
                  ) : (
                    <div>
                      <b className="text-foreground">{k.workspace_ids.length}</b> gán · <b className="text-foreground">{st.using.length}</b> đang dùng
                    </div>
                  )}
                </div>
                <div>
                  <SellBadge active={k.is_active} />
                  {st.issues.length > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {st.issues.map((i) => (
                        <span key={i.key} className={cn("text-xs font-medium", i.tone === "error" ? "text-destructive" : "text-warning")}>
                          {i.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="hidden h-4 w-4 text-muted-foreground/60 lg:block" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

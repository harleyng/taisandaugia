import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdvertisements } from "@/hooks/useAdvertisements";
import { AdStatusTabs } from "@/components/admin/advertising/AdStatusTabs";
import { AdFilterBar, type AdListFilters } from "@/components/admin/advertising/AdFilterBar";
import { AdTable } from "@/components/admin/advertising/AdTable";
import type { Advertisement, AdStatus } from "@/types/advertising";

const EMPTY_FILTERS: AdListFilters = { search: "", dateFrom: "", dateTo: "" };

export default function AdminAdsPage() {
  const navigate = useNavigate();
  const { data: ads, isLoading } = useAdvertisements();

  const [tab, setTab] = useState<AdStatus | "all">("all");
  const [filters, setFilters] = useState<AdListFilters>(EMPTY_FILTERS);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: ads?.length ?? 0 };
    for (const a of ads ?? []) acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, [ads]);

  const filtered = useMemo(() => {
    let list = ads ?? [];
    if (tab !== "all") list = list.filter((a) => a.status === tab);
    const q = filters.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.code ?? "").toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q),
      );
    }
    if (filters.dateFrom) list = list.filter((a) => a.created_at.slice(0, 10) >= filters.dateFrom);
    if (filters.dateTo) list = list.filter((a) => a.created_at.slice(0, 10) <= filters.dateTo);
    return list;
  }, [ads, tab, filters]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Quảng cáo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{ads?.length ?? 0} banner</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/marketing/quang-cao/vi-tri")}>
            <MapPin className="h-4 w-4 mr-1.5" />
            Quản lý vị trí
          </Button>
          <Button size="sm" onClick={() => navigate("/admin/marketing/quang-cao/new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo banner
          </Button>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <AdFilterBar filters={filters} onChange={setFilters} />
        <AdStatusTabs active={tab} counts={counts} onChange={setTab} />
      </div>

      <AdTable
        ads={filtered}
        isLoading={isLoading}
        onView={(a: Advertisement) => navigate(`/admin/marketing/quang-cao/${a.id}`)}
        onCreate={() => navigate("/admin/marketing/quang-cao/new")}
      />
    </div>
  );
}

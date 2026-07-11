import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminCampaigns } from "@/hooks/useCampaigns";
import { CampaignStatusTabs } from "@/components/admin/marketing/CampaignStatusTabs";
import {
  CampaignFilterBar,
  type CampaignListFilters,
} from "@/components/admin/marketing/CampaignFilterBar";
import { CampaignTable } from "@/components/admin/marketing/CampaignTable";
import type { Campaign, CampaignStatus } from "@/types/marketing";

const EMPTY_FILTERS: CampaignListFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
};

const effectiveDate = (c: Campaign) =>
  (c.sent_at ?? c.scheduled_at ?? c.created_at).slice(0, 10);

export default function AdminCampaignsPage() {
  const navigate = useNavigate();
  const { data: campaigns, isLoading } = useAdminCampaigns();

  const [tab, setTab] = useState<CampaignStatus | "all">("all");
  const [filters, setFilters] = useState<CampaignListFilters>(EMPTY_FILTERS);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: campaigns?.length ?? 0 };
    for (const c of campaigns ?? []) acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, [campaigns]);

  const filtered = useMemo(() => {
    let list = campaigns ?? [];
    if (tab !== "all") list = list.filter((c) => c.status === tab);
    const q = filters.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.subject ?? "").toLowerCase().includes(q),
      );
    }
    if (filters.dateFrom) list = list.filter((c) => effectiveDate(c) >= filters.dateFrom);
    if (filters.dateTo) list = list.filter((c) => effectiveDate(c) <= filters.dateTo);
    return list;
  }, [campaigns, tab, filters]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Email Marketing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {campaigns?.length ?? 0} chiến dịch
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/admin/marketing/email/new")}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo chiến dịch
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <CampaignFilterBar filters={filters} onChange={setFilters} />
        <CampaignStatusTabs active={tab} counts={counts} onChange={setTab} />
      </div>

      <CampaignTable
        campaigns={filtered}
        isLoading={isLoading}
        onView={(c) => navigate(`/admin/marketing/email/${c.id}`)}
        onCreate={() => navigate("/admin/marketing/email/new")}
      />
    </div>
  );
}

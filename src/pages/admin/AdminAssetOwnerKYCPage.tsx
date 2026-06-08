import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { User, Building2, RefreshCw, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { ORG_TYPE_LABELS } from "@/types/asset-owner";
import type { OrgType } from "@/types/asset-owner";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; className: string }> = {
  draft:          { label: "Nháp",       className: "bg-muted text-muted-foreground" },
  pending_review: { label: "Chờ duyệt",  className: "bg-amber-100 text-amber-800" },
  under_review:   { label: "Đang xét",   className: "bg-blue-100 text-blue-800" },
  approved:       { label: "Đã duyệt",   className: "bg-green-100 text-green-800" },
  rejected:       { label: "Từ chối",    className: "bg-red-100 text-red-800" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${s.className}`}>
      {s.label}
    </span>
  );
};

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "pending_review" | "approved" | "rejected";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all",           label: "Tất cả" },
  { key: "pending_review", label: "Chờ duyệt" },
  { key: "approved",      label: "Đã duyệt" },
  { key: "rejected",      label: "Từ chối" },
];

interface IndRow {
  id: string;
  status: string;
  full_name: string | null;
  phone: string | null;
  submitted_at: string | null;
  profiles: { name: string | null; email: string } | null;
}

interface OrgRow {
  id: string;
  status: string;
  org_name: string | null;
  org_type: string | null;
  submitted_at: string | null;
  profiles: { name: string | null; email: string } | null;
}

// ─── Shared tab bar ───────────────────────────────────────────────────────────

function TabBar<T extends string>({
  tabs, active, countFor, onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  countFor: (k: T) => number;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={[
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
            active === key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {label}
          <span className={[
            "text-[10px] rounded-full px-1.5 py-0.5 font-semibold",
            active === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
          ].join(" ")}>
            {countFor(key)}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type MainTab = "individual" | "organization";

export default function AdminAssetOwnerKYCPage() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<MainTab>("individual");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [indRows, setIndRows] = useState<IndRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [indRes, orgRes] = await Promise.all([
      supabase
        .from("asset_owner_kyc")
        .select("id, status, full_name, phone, submitted_at, profiles!asset_owner_kyc_user_id_fkey(name, email)")
        .neq("status", "draft")
        .order("submitted_at", { ascending: false }),
      supabase
        .from("asset_owner_org_kyc")
        .select("id, status, org_name, org_type, submitted_at, profiles!asset_owner_org_kyc_created_by_fkey(name, email)")
        .neq("status", "draft")
        .order("submitted_at", { ascending: false }),
    ]);

    if (indRes.error || orgRes.error) {
      toast.error("Không thể tải danh sách hồ sơ");
    } else {
      setIndRows((indRes.data ?? []) as IndRow[]);
      setOrgRows((orgRes.data ?? []) as OrgRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Reset filter khi đổi main tab
  const handleMainTab = (t: MainTab) => { setMainTab(t); setStatusFilter("all"); };

  const filteredInd = statusFilter === "all" ? indRows : indRows.filter((r) => r.status === statusFilter);
  const filteredOrg = statusFilter === "all" ? orgRows : orgRows.filter((r) => r.status === statusFilter);
  const countIndFor = (k: StatusFilter) => k === "all" ? indRows.length : indRows.filter((r) => r.status === k).length;
  const countOrgFor = (k: StatusFilter) => k === "all" ? orgRows.length : orgRows.filter((r) => r.status === k).length;

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Duyệt KYC Chủ tài sản</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Xem xét và phê duyệt hồ sơ xác thực chủ tài sản</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Làm mới
        </Button>
      </div>

      {/* Main tabs: Cá nhân / Tổ chức */}
      <div className="flex gap-2 border-b border-border">
        {([
          { key: "individual" as MainTab, label: "Cá nhân", icon: User, count: indRows.length },
          { key: "organization" as MainTab, label: "Tổ chức", icon: Building2, count: orgRows.length },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => handleMainTab(key)}
            className={[
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              mainTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      {mainTab === "individual" ? (
        <TabBar
          tabs={STATUS_TABS}
          active={statusFilter}
          countFor={countIndFor}
          onChange={setStatusFilter}
        />
      ) : (
        <TabBar
          tabs={STATUS_TABS}
          active={statusFilter}
          countFor={countOrgFor}
          onChange={setStatusFilter}
        />
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : mainTab === "individual" ? (
          filteredInd.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Không có hồ sơ nào</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Người nộp</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Họ tên KYC</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ngày nộp</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Trạng thái</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredInd.map((row, i) => (
                  <tr key={row.id} className={i < filteredInd.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.profiles?.name ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">{row.profiles?.email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {row.submitted_at
                        ? formatDistanceToNow(new Date(row.submitted_at), { addSuffix: true, locale: vi })
                        : "Chưa nộp"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => navigate(`/admin/chu-tai-san/ca-nhan/${row.id}`)}
                      >
                        Xem hồ sơ
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          filteredOrg.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Không có hồ sơ nào</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tên tổ chức</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Loại</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Người nộp</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ngày nộp</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Trạng thái</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrg.map((row, i) => (
                  <tr key={row.id} className={i < filteredOrg.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-4 py-3 font-medium text-foreground">{row.org_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {row.org_type ? ORG_TYPE_LABELS[row.org_type as OrgType] ?? row.org_type : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.profiles?.name ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">{row.profiles?.email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {row.submitted_at
                        ? formatDistanceToNow(new Date(row.submitted_at), { addSuffix: true, locale: vi })
                        : "Chưa nộp"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => navigate(`/admin/chu-tai-san/to-chuc/${row.id}`)}
                      >
                        Xem hồ sơ
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

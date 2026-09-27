import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminContractsTable } from "@/components/admin/contracts/AdminContractsTable";
import { useAdminContracts } from "@/hooks/useAdminContracts";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { matchesAdminContractSearch } from "@/lib/contracts/adminRows";
import { CONTRACT_TYPE_TABS } from "@/lib/contracts/rows";
import type { ContractTypeKey } from "@/lib/contracts/paths";
import { cn } from "@/lib/utils";

const DEFAULTS: { loai: "tat-ca" | ContractTypeKey; q: string } = { loai: "tat-ca", q: "" };
const ALLOWED = { loai: CONTRACT_TYPE_TABS.map((t) => t.key) } as const;

/**
 * Hợp đồng — giám sát mọi hợp đồng trên sàn: ký gửi (chủ tài sản ↔ tổ chức), mua
 * bán (bên bán ↔ người trúng), cung ứng dịch vụ (chủ tài sản ↔ sàn). Chỉ đọc: thao
 * tác thuộc về các bên (hợp đồng dịch vụ xử lý ở "Yêu cầu dịch vụ").
 */
export default function AdminContractsPage() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading, isFetching, error, refetch } = useAdminContracts();
  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);

  const ofTab = useMemo(() => (f.loai === "tat-ca" ? rows : rows.filter((r) => r.type === f.loai)), [rows, f.loai]);
  const visible = useMemo(() => ofTab.filter((r) => matchesAdminContractSearch(r, f.q)), [ofTab, f.q]);

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Hợp đồng</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Hợp đồng ký gửi, mua bán tài sản đấu giá và hợp đồng dịch vụ trên sàn
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={f.q}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Tìm theo mã, tài sản, các bên…"
            className="h-9 w-72 rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loại hợp đồng">
          {CONTRACT_TYPE_TABS.map((t) => {
            const active = f.loai === t.key;
            const count = t.key === "tat-ca" ? rows.length : rows.filter((r) => r.type === t.key).length;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter("loai", t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-semibold",
                    active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-destructive">Không tải được danh sách hợp đồng.</div>
        ) : (
          <AdminContractsTable rows={visible} showKind={f.loai === "tat-ca" || f.loai === "dich-vu"} onOpen={(r) => navigate(r.href)} />
        )}
      </div>
      <p className="text-xs text-muted-foreground">Hiển thị tối đa 500 hợp đồng mới nhất mỗi loại.</p>
    </div>
  );
}

import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { useServiceRequests } from "@/hooks/useServiceRequests";
import { ServiceRequestFilters } from "@/components/admin/service-requests/ServiceRequestFilters";
import { ServiceRequestTable } from "@/components/admin/service-requests/ServiceRequestTable";
import { AuthenticationSettingsPanel } from "@/components/admin/authentication/AuthenticationSettingsPanel";
import { SERVICE_GROUPS } from "@/lib/serviceRequests/groups";
import { SERVICE_KINDS, serviceRequestDetailPath } from "@/lib/serviceRequests/kinds";
import { matchesServiceSearch } from "@/lib/serviceRequests/normalize";

const FILTER_DEFAULTS = { loai: "all", nhom: "all", q: "", xem: "" };
const FILTER_OPTIONS = {
  loai: ["all", ...SERVICE_KINDS.map((k) => k.key)],
  nhom: ["all", ...SERVICE_GROUPS.map((g) => g.key)],
  xem: ["cai-dat"],
};

/**
 * Yêu cầu dịch vụ — hàng đợi gộp tư vấn pháp lý, tư vấn đấu giá, giám định, VR tour.
 * Danh sách chung; thao tác vẫn nằm ở trang chi tiết riêng từng loại (admin làm THAY đối tác).
 */
export default function AdminServiceRequestsPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { kinds, rows, isLoading, isFetching, failedKinds, refetch } = useServiceRequests();
  const [filters, , setFilters] = useUrlFilterState(FILTER_DEFAULTS, FILTER_OPTIONS);

  // Link cũ / tab của loại không có quyền ⇒ rơi về "Tất cả" các loại được xem.
  const kind = kinds.some((k) => k.key === filters.loai) ? filters.loai : "all";
  const settings = kind === "giam-dinh" && filters.xem === "cai-dat";

  const ofKind = useMemo(() => (kind === "all" ? rows : rows.filter((r) => r.kind === kind)), [rows, kind]);
  const visible = useMemo(
    () =>
      ofKind.filter((r) => (filters.nhom === "all" || r.group === filters.nhom) && matchesServiceSearch(r, filters.q)),
    [ofKind, filters.nhom, filters.q],
  );

  const kindCount = (key: string) => (key === "all" ? rows.length : rows.filter((r) => r.kind === key).length);
  const groupCount = (key: string) => (key === "all" ? ofKind.length : ofKind.filter((r) => r.group === key).length);

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Yêu cầu dịch vụ</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Báo giá, điều phối đối tác và theo dõi kết quả tư vấn pháp lý, tư vấn đấu giá, giám định, VR tour
          </p>
        </div>
        {!settings && (
          <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        )}
      </div>

      <ServiceRequestFilters
        kinds={kinds}
        kind={kind}
        group={filters.nhom}
        q={filters.q}
        settings={settings}
        showSettings={kind === "giam-dinh"}
        kindCount={kindCount}
        groupCount={groupCount}
        onChange={setFilters}
      />

      {settings ? (
        <AuthenticationSettingsPanel />
      ) : (
        <>
          {failedKinds.length > 0 && (
            <p className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Không tải được: {failedKinds.join(", ")}. Bấm "Làm mới" để thử lại.
            </p>
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>
            ) : (
              <ServiceRequestTable
                rows={visible}
                showKind={kind === "all" && kinds.length > 1}
                onOpen={(row) => navigate(serviceRequestDetailPath(row.kind, row.id), { state: { listSearch: search } })}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

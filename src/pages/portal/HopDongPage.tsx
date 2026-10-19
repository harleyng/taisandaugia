import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, FileSignature, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ContractsTable } from "@/components/asset-owner-portal/contracts/ContractsTable";
import { ConsignmentCanvas } from "@/components/portal/consignment/ConsignmentCanvas";
import { useOrgPermissions } from "@/hooks/useOrgPermissions";
import { useSessionOrg } from "@/hooks/useSessionOrg";
import { useOrgSaleContracts } from "@/hooks/useSaleContracts";
import { useOrgConsignmentContractList } from "@/hooks/useOrgServiceRequests";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { orgMatrixHas } from "@/lib/orgPermissions";
import {
  ALL,
  PORTAL_CONTRACT_TABS,
  fromOrgConsignment,
  fromOrgSale,
  matchesPortalContractSearch,
  matchesPortalContractTab,
  matchesPortalSaleFilters,
  sortPortalContractRows,
  type PortalContractRow,
  type PortalContractTab,
} from "@/lib/contracts/portalRows";
import { SALE_STAGE_LABELS, type SaleAssetSnapshot, type SaleStage } from "@/types/auction-sale-contract";

const DEFAULTS = { loai: "tat-ca", q: "", session: ALL, "giai-doan": ALL, "qua-han": ALL };
const ALLOWED = {
  loai: PORTAL_CONTRACT_TABS.map((t) => t.key),
  "giai-doan": [ALL, ...Object.keys(SALE_STAGE_LABELS)],
  "qua-han": [ALL, "1"],
};

/**
 * /portal/hop-dong — mọi hợp đồng tổ chức là một bên: ký gửi với chủ tài sản và
 * mua bán với người trúng đấu giá. Mỗi loại theo mã quyền riêng của nó
 * (yeu-cau-ky-gui / hop-dong-mua-ban) — thiếu quyền loại nào thì loại đó không tải.
 * Ký gửi mở ở trang yêu cầu (thẻ hợp đồng ở đó), mua bán mở trang chi tiết riêng.
 */
export default function HopDongPage() {
  const navigate = useNavigate();
  const { isOwner, matrix, ready } = useOrgPermissions();
  const canConsign = ready && (isOwner || orgMatrixHas(matrix, "yeu-cau-ky-gui", "view"));
  const canSale = ready && (isOwner || orgMatrixHas(matrix, "hop-dong-mua-ban", "view"));

  const { organizationId, loading: orgLoading } = useSessionOrg();
  const consignQ = useOrgConsignmentContractList(canConsign);
  const saleQ = useOrgSaleContracts(canSale ? organizationId : null);

  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);
  const tabs = PORTAL_CONTRACT_TABS.filter(
    (t) => (t.key !== "ky-gui" || canConsign) && (t.key !== "mua-ban" || canSale),
  );
  // Link dán sang tab của loại không có quyền xem ⇒ về "Tất cả" thay vì một tab vô hình.
  const tab: PortalContractTab = tabs.some((t) => t.key === f.loai) ? (f.loai as PortalContractTab) : "tat-ca";

  const rows = useMemo(
    () =>
      sortPortalContractRows([
        ...(canConsign ? (consignQ.data ?? []).map(fromOrgConsignment) : []),
        ...(canSale ? (saleQ.data ?? []).map((c) => fromOrgSale(c)) : []),
      ]),
    [canConsign, canSale, consignQ.data, saleQ.data],
  );

  // Phiên lấy từ chính hợp đồng: người chỉ có quyền hợp đồng (không có quyền phiên) vẫn lọc được.
  const sessions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of saleQ.data ?? []) {
      const a = (c.asset_snapshot ?? {}) as SaleAssetSnapshot;
      if (!map.has(c.session_id)) map.set(c.session_id, a.session_code ?? c.session_id.slice(0, 8));
    }
    return [...map.entries()];
  }, [saleQ.data]);

  const saleFilters = { session: f.session, stage: f["giai-doan"], overdue: f["qua-han"] };
  // Số trên tab không phụ thuộc ô tìm / bộ lọc (luật chung với menu Hợp đồng của chủ tài sản).
  const visible = rows.filter(
    (r) =>
      matchesPortalContractTab(tab, r) &&
      (tab !== "mua-ban" || matchesPortalSaleFilters(r, saleFilters)) &&
      matchesPortalContractSearch(r, f.q),
  );

  const isLoading = !ready || orgLoading || (canConsign && consignQ.isLoading) || (canSale && saleQ.isLoading);
  const error = consignQ.error ?? saleQ.error;
  const refetch = () => {
    if (canConsign) consignQ.refetch();
    if (canSale) saleQ.refetch();
  };

  const open = (row: PortalContractRow) => navigate(row.href);

  return (
    <ConsignmentCanvas>
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Hợp đồng</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ký gửi đấu giá với chủ tài sản và mua bán tài sản với người trúng đấu giá.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-card p-10 text-sm text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Đang tải hợp đồng…
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState
            icon={AlertCircle}
            tone="destructive"
            title="Không tải được danh sách hợp đồng"
            description="Vui lòng thử lại."
            action={
              <Button variant="outline" onClick={refetch}>
                Thử lại
              </Button>
            }
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState
            icon={FileSignature}
            title="Chưa có hợp đồng nào"
            description="Hợp đồng ký gửi có khi chủ tài sản chốt báo giá của tổ chức; hợp đồng mua bán được lập từ trang điều hành phiên sau khi chốt kết quả."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <OwnerTabBar
            aria-label="Lọc hợp đồng"
            value={tab}
            onValueChange={(v) => setFilter("loai", v)}
            items={tabs.map((t) => ({
              value: t.key,
              label: t.label,
              count: rows.filter((r) => matchesPortalContractTab(t.key, r)).length,
              attention: t.key === "can-xu-ly",
            }))}
          />
          <div className="flex flex-wrap gap-2">
            {tab === "mua-ban" && (
              <>
                <OwnerFilterSelect
                  label="Phiên"
                  value={f.session}
                  onValueChange={(v) => setFilter("session", v)}
                  className="sm:w-[12rem]"
                >
                  <SelectItem value={ALL}>Tất cả</SelectItem>
                  {sessions.map(([id, code]) => (
                    <SelectItem key={id} value={id}>
                      {code}
                    </SelectItem>
                  ))}
                </OwnerFilterSelect>
                <OwnerFilterSelect
                  label="Giai đoạn"
                  value={f["giai-doan"]}
                  onValueChange={(v) => setFilter("giai-doan", v)}
                  className="sm:w-[13rem]"
                >
                  <SelectItem value={ALL}>Tất cả</SelectItem>
                  {(Object.keys(SALE_STAGE_LABELS) as SaleStage[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SALE_STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </OwnerFilterSelect>
                <OwnerFilterSelect
                  label="Hạn"
                  value={f["qua-han"]}
                  onValueChange={(v) => setFilter("qua-han", v)}
                  className="sm:w-[11rem]"
                >
                  <SelectItem value={ALL}>Tất cả</SelectItem>
                  <SelectItem value="1">Chỉ quá hạn</SelectItem>
                </OwnerFilterSelect>
              </>
            )}
            <OwnerSearchInput
              aria-label="Tìm hợp đồng theo mã, tài sản hoặc bên kia"
              placeholder="Tìm theo mã, tài sản, bên kia"
              value={f.q}
              onValueChange={(v) => setFilter("q", v)}
              className="sm:w-auto sm:max-w-[22rem] sm:flex-[1_1_16rem]"
            />
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl bg-card shadow-card">
              <EmptyState
                icon={FileSignature}
                compact
                title={tab === "can-xu-ly" && !f.q ? "Không có hợp đồng nào chờ bạn" : "Không có hợp đồng nào khớp"}
                description={f.q ? "Thử từ khoá khác." : undefined}
              />
            </div>
          ) : (
            <ContractsTable
              rows={visible}
              briefOf={(r) => (r as PortalContractRow).brief}
              onOpen={(r) => open(r as PortalContractRow)}
              markNeedsAction={false}
            />
          )}
        </div>
      )}
    </ConsignmentCanvas>
  );
}

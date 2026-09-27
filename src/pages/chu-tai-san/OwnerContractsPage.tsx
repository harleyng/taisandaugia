import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ContractsTable } from "@/components/asset-owner-portal/contracts/ContractsTable";
import { ServiceContractAcceptDialog } from "@/components/service-contracts/ServiceContractAcceptDialog";
import { useOwnerContracts } from "@/hooks/useOwnerContracts";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import {
  CONTRACT_TABS,
  contractActionCount,
  matchesContractSearch,
  matchesContractTab,
  type ContractListRow,
} from "@/lib/contracts/rows";
import type { ContractTab } from "@/lib/contracts/paths";

const DEFAULTS: { loai: ContractTab; q: string } = { loai: "tat-ca", q: "" };
const ALLOWED = { loai: CONTRACT_TABS.map((t) => t.key) } as const;

type ServiceTarget = NonNullable<ContractListRow["service"]>;

/**
 * /chu-tai-san/hop-dong — mọi hợp đồng tenant đang chọn là một bên:
 * ký gửi với tổ chức đấu giá, mua bán với người trúng, cung ứng dịch vụ với sàn.
 * Việc cần làm lên đầu; mỗi dòng mở trang chi tiết của đúng loại.
 */
export default function OwnerContractsPage() {
  const navigate = useNavigate();
  const { rows, briefOf, isLoading, error, refetch } = useOwnerContracts();
  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);
  const [accepting, setAccepting] = useState<ServiceTarget | null>(null);

  const actionCount = contractActionCount(rows);
  // Số trên tab không phụ thuộc ô tìm (luật chung của Trạm).
  const visible = rows.filter((r) => matchesContractTab(f.loai, r) && matchesContractSearch(r, f.q));

  const open = (row: ContractListRow) => {
    // Báo giá dịch vụ chờ chính mình đồng ý ⇒ mở hợp đồng ngay tại đây.
    if (row.needsAction && row.type === "dich-vu" && row.service && !row.code) setAccepting(row.service);
    else navigate(row.href);
  };

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Hợp đồng"
        subtitle={
          <>
            {actionCount > 0 && (
              <b className="font-semibold text-warning">{actionCount} hợp đồng cần bạn xử lý. </b>
            )}
            Ký gửi với tổ chức đấu giá, mua bán với người trúng và hợp đồng dịch vụ của tài sản.
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-10 w-full max-w-xl rounded-xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
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
            description="Hợp đồng ký gửi có khi bạn chốt báo giá của tổ chức đấu giá; hợp đồng dịch vụ có khi sàn báo giá VR tour, giám định hoặc tư vấn."
          />
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerFilterBar
            tabs={
              <OwnerTabBar
                value={f.loai}
                onValueChange={(v) => setFilter("loai", v)}
                aria-label="Lọc hợp đồng"
                items={CONTRACT_TABS.map((t) => ({
                  value: t.key,
                  label: t.label,
                  count: rows.filter((r) => matchesContractTab(t.key, r)).length,
                  attention: t.key === "can-xu-ly",
                }))}
              />
            }
          >
            <OwnerSearchInput
              value={f.q}
              onValueChange={(v) => setFilter("q", v)}
              placeholder="Tìm theo mã, tài sản, bên kia"
              aria-label="Tìm hợp đồng theo mã, tên tài sản hoặc bên kia"
            />
          </OwnerFilterBar>

          {visible.length === 0 ? (
            <div className="rounded-2xl bg-card shadow-card">
              <EmptyState
                icon={FileSignature}
                compact
                title={f.loai === "can-xu-ly" && !f.q ? "Không có hợp đồng nào chờ bạn" : "Không có hợp đồng nào khớp"}
                description={f.q ? "Thử từ khoá khác." : undefined}
              />
            </div>
          ) : (
            <ContractsTable rows={visible} briefOf={briefOf} onOpen={open} />
          )}
        </div>
      )}

      {accepting && (
        <ServiceContractAcceptDialog
          kind={accepting.kind}
          orderId={accepting.orderId}
          open
          onOpenChange={(v) => !v && setAccepting(null)}
        />
      )}
    </div>
  );
}

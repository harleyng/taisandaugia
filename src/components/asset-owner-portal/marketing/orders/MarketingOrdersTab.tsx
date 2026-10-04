import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ClipboardList, Handshake, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { useOwnerSubscription } from "@/hooks/useOwnerSubscription";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useMarketingPackages, useOwnerMarketingOrders } from "@/hooks/useOwnerMarketingOrders";
import { coverageFor, coverageLabel } from "@/lib/ownerSubscription/coverage";
import {
  MKT_ORDER_BENEFIT,
  MKT_PICKABLE_PACKAGES,
  ORDER_FILTERS,
  needsOwnerAction,
  orderFilterOf,
  type MktOrderPackage,
  type OrderFilter,
} from "@/lib/ownerMarketing/orders";
import { ownerMarketingOrderHref } from "@/lib/ownerMarketing/routes";
import { ChooseMarketingPackageDialog } from "./ChooseMarketingPackageDialog";
import { CreateMarketingOrderDialog } from "./CreateMarketingOrderDialog";
import { MarketingOrderList } from "./MarketingOrderList";

/**
 * Tab "Giao việc cho sàn" (Phase M4): danh sách đơn; bấm một dòng mở trang chi tiết đơn
 * (/chu-tai-san/truyen-thong/giao-viec/:id). "Tạo đơn mới" mở
 * hộp chọn gói → hộp đặt (tài sản + mục tiêu). `?dat=<listingId>` (từ trang Tài sản) mở hộp
 * chọn gói với tài sản đó chọn sẵn.
 */
export function MarketingOrdersTab() {
  const navigate = useNavigate();
  const { workspaceId, can } = useOwnerWorkspace();
  const [params, setParams] = useSearchParams();
  const { data: allPackages, isLoading: loadingPackages } = useMarketingPackages();
  const packages = useMemo(
    () => (allPackages ?? []).filter((p) => MKT_PICKABLE_PACKAGES.includes(p.key)),
    [allPackages],
  );
  const { orders, isLoading, isError, refetch } = useOwnerMarketingOrders();
  const { data: subscription } = useOwnerSubscription(workspaceId);

  const canOrder = can("truyen-thong", "share");
  const [filter, setFilter] = useState<OrderFilter>("dang-mo");
  // Hai bước nối nhau: picking (chọn gói) → create (tài sản, mục tiêu, thanh toán).
  const [picking, setPicking] = useState<{ listingId: string | null } | null>(null);
  const [create, setCreate] = useState<{ pkg: MktOrderPackage; listingId: string | null } | null>(null);

  // Lối vào từ trang Tài sản: mở hộp đặt một lần rồi bỏ tham số khỏi URL.
  const preselect = params.get("dat");
  useEffect(() => {
    if (!preselect) return;
    if (canOrder) setPicking({ listingId: preselect });
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("dat");
        return next;
      },
      { replace: true },
    );
  }, [preselect, canOrder, setParams]);

  const counts = useMemo(() => {
    const c: Record<OrderFilter, number> = { "dang-mo": 0, "hoan-tat": 0, "da-huy": 0 };
    for (const o of orders) c[orderFilterOf(o.status)] += 1;
    return c;
  }, [orders]);
  const attention = orders.some((o) => needsOwnerAction(o));
  const visible = useMemo(() => orders.filter((o) => orderFilterOf(o.status) === filter), [orders, filter]);

  const coverageOf = (key: MktOrderPackage) => {
    const benefit = MKT_ORDER_BENEFIT[key];
    if (!benefit) return { coverage: null, text: "" };
    const coverage = coverageFor(subscription, benefit);
    return { coverage, text: coverageLabel(coverage, benefit) };
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="Đơn đã giao cho sàn"
        icon={ClipboardList}
        count={orders.length}
        actions={
          canOrder && (
            <Button size="sm" onClick={() => setPicking({ listingId: null })}>
              <Plus className="mr-1.5 h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Tạo đơn mới
            </Button>
          )
        }
      >
        <OwnerTabBar
          aria-label="Lọc đơn theo trạng thái"
          value={filter}
          onValueChange={(v) => setFilter(v as OrderFilter)}
          items={ORDER_FILTERS.map((f) => ({
            value: f.key,
            label: f.label,
            count: counts[f.key],
            attention: f.key === "dang-mo" && attention,
          }))}
        />

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            compact
            icon={AlertCircle}
            tone="destructive"
            title="Không tải được danh sách đơn"
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Thử lại
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={Handshake}
            tone="muted"
            title={filter === "dang-mo" ? "Chưa có đơn nào đang mở" : "Chưa có đơn ở mục này"}
            description={
              filter === "dang-mo" && canOrder
                ? "Bấm “Tạo đơn mới” và chọn gói để sàn đẩy truyền thông cho tài sản của bạn."
                : undefined
            }
          />
        ) : (
          <MarketingOrderList orders={visible} onOpen={(o) => navigate(ownerMarketingOrderHref(o.id))} />
        )}
      </SectionCard>

      <ChooseMarketingPackageDialog
        open={!!picking}
        onOpenChange={(v) => !v && setPicking(null)}
        packages={packages}
        isLoading={loadingPackages}
        coverageOf={coverageOf}
        onChoose={(pkg) => {
          setCreate({ pkg, listingId: picking?.listingId ?? null });
          setPicking(null);
        }}
      />
      <CreateMarketingOrderDialog
        open={!!create}
        onOpenChange={(v) => !v && setCreate(null)}
        packages={packages}
        initialPackage={create?.pkg}
        initialListingId={create?.listingId}
        onChangePackage={(listingId) => {
          setCreate(null);
          setPicking({ listingId });
        }}
      />
    </div>
  );
}

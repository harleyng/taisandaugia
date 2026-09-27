import { useMemo, useState } from "react";
import { HandCoins, Plus, ReceiptText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { OwnerTabsList, OwnerTabsTrigger } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { CashScopeSelect } from "@/components/asset-owner-portal/cash-flow/CashFlowFilters";
import { CollectionBuckets } from "@/components/asset-owner-portal/cash-flow/CollectionBuckets";
import { CollectionReceivablesTable } from "@/components/asset-owner-portal/cash-flow/CollectionReceivablesTable";
import { CashLedgerTable } from "@/components/asset-owner-portal/cash-flow/CashLedgerTable";
import { CashFlowDialogs } from "@/components/asset-owner-portal/cash-flow/CashFlowDialogs";
import {
  CashFlowLoadError,
  CashFlowNoWorkspace,
  CashFlowSkeleton,
} from "@/components/asset-owner-portal/cash-flow/CashFlowPageStates";
import type { CashDialogState } from "@/components/asset-owner-portal/cash-flow/cashFlowDialogState";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useCashCanWrite, useOwnerCashFlow } from "@/hooks/useOwnerCashFlow";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import {
  COLLECTION_BUCKETS,
  SCOPE_ALL,
  buildCollectionsView,
  collectionBucketOf,
  matchesAssetQuery,
  recordableRows,
  resolveScope,
  scopeData,
  type CollectionBucketKey,
} from "@/lib/ownerCashFlow";
import { formatDayFull } from "@/lib/ownerPulse";

const TAB_OWED = "con-phai-thu";
const TAB_LEDGER = "da-ghi";
const DEFAULTS = { scope: SCOPE_ALL, han: "", xem: TAB_OWED };
const ALLOWED = { han: COLLECTION_BUCKETS, xem: [TAB_OWED, TAB_LEDGER] } as const;

/**
 * "Thu tiền" — /chu-tai-san/thu-tien (tác nghiệp, tách khỏi Dòng tiền 2026-09-27).
 * Tính đến hôm nay, không có kỳ: ba nhóm theo hạn (cũng là bộ lọc) → bảng Còn phải thu / Đã ghi.
 * Trụ sở đã liên kết chi nhánh xem gộp toàn hệ thống, chỉ ghi được dòng của chính mình.
 */
const OwnerCollectionsPage = () => {
  const { workspaceId, workspace, isLoading: wsLoading } = useOwnerWorkspace();
  const { data, isLoading, isError, refetch } = useOwnerCashFlow(workspaceId);
  const canWrite = useCashCanWrite(data);
  const [f, , setFilters] = useUrlFilterState(DEFAULTS, ALLOWED);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<CashDialogState | null>(null);

  const scope = data ? resolveScope(f.scope, data.units) : SCOPE_ALL;
  const scoped = useMemo(() => (data ? scopeData(data, scope) : null), [data, scope]);
  const view = useMemo(() => (scoped ? buildCollectionsView(scoped) : null), [scoped]);
  const bucket = (f.han || null) as CollectionBucketKey | null;

  const owed = useMemo(
    () =>
      view
        ? view.receivables.filter(
            (r) =>
              (!bucket || collectionBucketOf(r, view.asOf) === bucket) &&
              matchesAssetQuery({ title: r.row.title, assetCode: r.row.assetCode }, query),
          )
        : [],
    [view, bucket, query],
  );
  const ledger = useMemo(() => (view ? view.ledger.filter((e) => matchesAssetQuery(e, query)) : []), [view, query]);
  // Tên đơn vị chỉ cần khi đang xem gộp nhiều đơn vị.
  const unitNames = useMemo(
    () => (scoped && scoped.units.length > 1 ? new Map(scoped.units.map((u) => [u.id, u.name])) : null),
    [scoped],
  );
  const canRecord = !!data && recordableRows(data).some((r) => canWrite(r.unitId, r.branchId));
  const record = () => setDialog({ kind: "record", outcomeId: null, presetKind: "payment" });
  const clearFilters = () => {
    setQuery("");
    setFilters({ han: "" });
  };

  if (wsLoading || (workspaceId && isLoading)) return <CashFlowSkeleton />;
  if (!workspaceId || !workspace) return <CashFlowNoWorkspace feature="Thu tiền" />;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Thu tiền"
        subtitle={data ? `Tính đến hôm nay, ${formatDayFull(data.asOf)}` : undefined}
        actions={
          <>
            {data && <CashScopeSelect scope={scope} units={data.units} onChange={(s) => setFilters({ scope: s })} />}
            {canRecord && (
              <Button className="gap-1.5" onClick={record}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Ghi thu
              </Button>
            )}
          </>
        }
      />

      {isError || !data || !view ? (
        <CashFlowLoadError onRetry={() => void refetch()} />
      ) : (
        <>
          <CollectionBuckets
            buckets={view.buckets}
            active={bucket}
            onToggle={(k) => setFilters({ han: bucket === k ? "" : k, xem: TAB_OWED })}
          />

          <Tabs value={f.xem} onValueChange={(v) => v && setFilters({ xem: v })}>
            <section className="space-y-4 rounded-2xl bg-card p-4 shadow-card sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <OwnerTabsList aria-label="Xem khoản thu" className="sm:flex-1">
                  <OwnerTabsTrigger value={TAB_OWED}>Còn phải thu</OwnerTabsTrigger>
                  <OwnerTabsTrigger value={TAB_LEDGER}>Đã ghi</OwnerTabsTrigger>
                </OwnerTabsList>
                <OwnerSearchInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Tìm tài sản…"
                  aria-label="Tìm tài sản theo tên hoặc mã"
                />
              </div>

              <TabsContent value={TAB_OWED} className="mt-0">
                {view.receivables.length === 0 ? (
                  <EmptyState compact icon={HandCoins} tone="success" title="Không còn khoản nào phải thu — tốt lắm." />
                ) : owed.length === 0 ? (
                  <NoMatch onClear={clearFilters} />
                ) : (
                  <CollectionReceivablesTable
                    items={owed}
                    asOf={view.asOf}
                    unitNames={unitNames}
                    canWrite={canWrite}
                    onAction={setDialog}
                  />
                )}
              </TabsContent>

              <TabsContent value={TAB_LEDGER} className="mt-0">
                {view.ledger.length === 0 ? (
                  <EmptyState
                    compact
                    icon={ReceiptText}
                    title="Chưa ghi khoản thu chi nào."
                    description="Mỗi lần tiền về hoặc trả phí, ghi một khoản để số đã thu luôn đúng."
                    action={
                      canRecord ? (
                        <Button variant="outline" size="sm" onClick={record}>
                          Ghi thu
                        </Button>
                      ) : undefined
                    }
                  />
                ) : ledger.length === 0 ? (
                  <NoMatch onClear={clearFilters} />
                ) : (
                  <CashLedgerTable events={ledger} unitNames={unitNames} canWrite={canWrite} onAction={setDialog} />
                )}
              </TabsContent>
            </section>
          </Tabs>

          <CashFlowDialogs
            workspaceId={workspaceId}
            data={data}
            state={dialog}
            canWrite={canWrite}
            onClose={() => setDialog(null)}
          />
        </>
      )}
    </div>
  );
};

function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      compact
      icon={Search}
      title="Không có khoản nào khớp."
      action={
        <Button variant="outline" size="sm" onClick={onClear}>
          Bỏ lọc
        </Button>
      }
    />
  );
}

export default OwnerCollectionsPage;

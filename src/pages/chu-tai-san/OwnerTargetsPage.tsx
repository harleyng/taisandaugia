import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReadOnlyNote } from "@/components/asset-owner-portal/pulse/PulseListParts";
import { TargetList } from "@/components/asset-owner-portal/targets/TargetList";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerTargetsBoard } from "@/hooks/useOwnerTargets";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import {
  OWNER_TARGET_NEW_HREF,
  SCOPE_ALL,
  TARGET_PERIOD_LABEL,
  TARGET_PERIOD_TYPES,
  TARGET_STATUSES,
  TARGET_STATUS_LABEL,
  targetScopeLabel,
  type TargetStatus,
} from "@/lib/ownerTargets";
import { ANY_FILTER, filterTargetGroups } from "@/lib/ownerTargetView";

const DEFAULTS = { tab: "in_progress", scope: ANY_FILTER, ky: ANY_FILTER };
const PERIOD_FILTERS = [ANY_FILTER, ...TARGET_PERIOD_TYPES];

/**
 * "Chỉ tiêu" — /chu-tai-san/chi-tieu (bản thiết kế "Chi Tieu - Danh sach & Chi tiet").
 * Tab Đang thực hiện (gồm kỳ sắp tới) · Đã hoàn thành · Không hoàn thành, lọc Phạm vi +
 * Loại kỳ; mỗi chỉ tiêu một thẻ-dòng, bấm vào mở trang chi tiết. Đặt / sửa ở trang form
 * riêng, chỉ Trưởng đơn vị (RLS manage_members mới là cổng thật, UI chỉ ẩn nút).
 */
const OwnerTargetsPage = () => {
  const navigate = useNavigate();
  const { isLoading: wsLoading } = useOwnerWorkspace();
  const { workspaceId, targets, groups, branches, canManage, isLoading, isError, refetch, today } =
    useOwnerTargetsBoard();

  const scopeIds = useMemo(() => [ANY_FILTER, SCOPE_ALL, ...branches.map((b) => b.id)], [branches]);
  const [f, , setFilters] = useUrlFilterState(DEFAULTS, {
    tab: TARGET_STATUSES,
    scope: scopeIds,
    ky: PERIOD_FILTERS,
  });
  const tab = f.tab as TargetStatus;
  const shown = useMemo(() => filterTargetGroups(groups, { scope: f.scope, type: f.ky }), [groups, f.scope, f.ky]);

  if (wsLoading || (workspaceId && isLoading)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-full rounded-xl" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <OwnerNoWorkspaceState icon={Target}>
        <EmptyState
          icon={Target}
          title="Chưa có không gian làm việc"
          description="Chỉ tiêu dành cho chủ tài sản là tổ chức đã xác thực, hoặc người được một đơn vị mời vào."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  const openNew = () => navigate(OWNER_TARGET_NEW_HREF);

  return (
    <div className="space-y-5">
      <OwnerPageHeader
        title="Chỉ tiêu"
        subtitle="Đặt và theo dõi chỉ tiêu theo tháng, quý, năm — cả đơn vị hoặc từng chi nhánh"
        actions={
          canManage ? (
            <Button className="gap-1.5" onClick={openNew}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Đặt chỉ tiêu
            </Button>
          ) : (
            <ReadOnlyNote>Chỉ Trưởng đơn vị đặt và sửa chỉ tiêu.</ReadOnlyNote>
          )
        }
      />

      {isError ? (
        <EmptyState
          icon={Target}
          tone="destructive"
          title="Chưa tải được chỉ tiêu."
          action={
            <Button variant="outline" onClick={refetch}>
              Thử lại
            </Button>
          }
        />
      ) : targets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Chưa có chỉ tiêu nào."
          description={
            canManage
              ? "Đặt chỉ tiêu theo tháng, quý hoặc năm với một hoặc nhiều tiêu chí để theo dõi tiến độ."
              : "Trưởng đơn vị chưa đặt chỉ tiêu."
          }
          action={canManage ? <Button onClick={openNew}>Đặt chỉ tiêu</Button> : undefined}
        />
      ) : (
        <>
          <OwnerFilterBar
            tabs={
              <OwnerTabBar
                aria-label="Trạng thái chỉ tiêu"
                value={tab}
                onValueChange={(t) => setFilters({ tab: t })}
                items={TARGET_STATUSES.map((s) => ({ value: s, label: TARGET_STATUS_LABEL[s], count: shown[s].length }))}
              />
            }
          >
            {branches.length > 0 && (
              <OwnerFilterSelect label="Phạm vi" value={f.scope} onValueChange={(scope) => setFilters({ scope })}>
                <SelectItem value={ANY_FILTER}>Tất cả phạm vi</SelectItem>
                {[SCOPE_ALL, ...branches.map((b) => b.id)].map((s) => (
                  <SelectItem key={s} value={s}>
                    {targetScopeLabel(s, branches)}
                  </SelectItem>
                ))}
              </OwnerFilterSelect>
            )}
            <OwnerFilterSelect label="Loại kỳ" value={f.ky} onValueChange={(ky) => setFilters({ ky })}>
              <SelectItem value={ANY_FILTER}>Tất cả</SelectItem>
              {TARGET_PERIOD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TARGET_PERIOD_LABEL[t]}
                </SelectItem>
              ))}
            </OwnerFilterSelect>
          </OwnerFilterBar>

          <TargetList status={tab} items={shown[tab]} branches={branches} today={today} />
        </>
      )}
    </div>
  );
};

export default OwnerTargetsPage;

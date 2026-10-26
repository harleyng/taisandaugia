import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, History, KanbanSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { usePlanProgress } from "@/hooks/useAuctionPlanProgress";
import { normalizeAdminSearch } from "@/lib/adminUnits";
import { PLAN_ITEM_HEALTH_LABELS, PLAN_ITEM_HEALTH_ORDER } from "@/lib/auctionPlan/health";
import { downloadPlanItemsExport } from "@/lib/auctionPlan/itemsImport";
import { QUARTERS, QUARTER_LABELS, quarterOf } from "@/lib/auctionPlan/totals";
import type { AuctionPlan, AuctionPlanItem } from "@/lib/auctionPlan/types";
import { CarryForwardDialog } from "./CarryForwardDialog";
import { DeletePlanItemDialog } from "./DeletePlanItemDialog";
import { PlanItemDialog } from "./PlanItemDialog";
import { PlanItemsImportDialog } from "./PlanItemsImportDialog";
import { PlanItemsTable } from "./PlanItemsTable";

const ANY = "all";
const NO_MONTH = "none";

export interface PlanItemsTabProps {
  plan: AuctionPlan;
  items: readonly AuctionPlanItem[];
  isLoading: boolean;
  /** Trường mốc đang mở để sửa (quyền + trạng thái kế hoạch). */
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
}

/**
 * Tab "Danh mục tài sản": thanh công cụ (tìm · lọc kỳ · thêm · nhập/xuất Excel ·
 * chuyển tiếp năm trước) + bảng theo biểu mẫu chính thức.
 *
 * Kế hoạch đã trình / đã duyệt ⇒ không có nút ghi nào; bấm một dòng vẫn mở hộp
 * thoại ở chế độ CHỈ XEM.
 */
export function PlanItemsTab({ plan, items, isLoading, canEdit, canCreate, canDelete }: PlanItemsTabProps) {
  const [term, setTerm] = useState("");
  const [period, setPeriod] = useState(ANY);
  const [health, setHealth] = useState(ANY);
  const [editing, setEditing] = useState<{ item: AuctionPlanItem | null } | null>(null);
  const [deleting, setDeleting] = useState<AuctionPlanItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [carrying, setCarrying] = useState(false);

  // Sức khoẻ (A5) — CÙNG nguồn với lưới tab "Tiến độ" (`usePlanProgress`), không
  // tính lại ở đây để chip trong bảng và ô trong lưới không bao giờ lệch nhau.
  const { rows: progressRows } = usePlanProgress(plan, items);
  const healthById = useMemo(
    () => new Map(progressRows.map((r) => [r.item.id, r.health])),
    [progressRows],
  );
  const healthCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of progressRows) map.set(r.health, (map.get(r.health) ?? 0) + 1);
    return map;
  }, [progressRows]);

  const shown = useMemo(() => {
    const q = normalizeAdminSearch(term);
    return items.filter((it) => {
      if (period === NO_MONTH && it.planned_month) return false;
      if (period !== ANY && period !== NO_MONTH && String(quarterOf(it.planned_month) ?? "") !== period) return false;
      if (health !== ANY && healthById.get(it.id) !== health) return false;
      if (!q) return true;
      const hay = [it.title, it.item_code, it.lot_labels, it.location, it.parcel_no, it.map_sheet]
        .filter(Boolean)
        .join(" ");
      return normalizeAdminSearch(hay).includes(q);
    });
  }, [items, term, period, health, healthById]);

  const exportItems = () =>
    downloadPlanItemsExport(`ke-hoach-dau-gia-${plan.plan_year}`, items.map((it) => ({
      item_code: it.item_code,
      title: it.title,
      lot_labels: it.lot_labels,
      area_m2: it.area_m2 === null ? null : Number(it.area_m2),
      location: it.location,
      unit_start_price: it.unit_start_price === null ? null : Number(it.unit_start_price),
      planned_month: it.planned_month,
      asset_type: it.asset_type,
      allocation_form: it.allocation_form,
      planned_method: it.planned_method,
      expected_start_value: it.expected_start_value === null ? null : Number(it.expected_start_value),
    })));

  if (isLoading) {
    return (
      <SectionCard title="Danh mục tài sản" icon={KanbanSquare}>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <>
      <SectionCard
        title="Danh mục tài sản"
        icon={KanbanSquare}
        count={items.length}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {items.length > 0 && (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={exportItems}>
                <Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                Xuất Excel
              </Button>
            )}
            {canCreate && (
              <>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => setCarrying(true)}>
                  <History className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  Chuyển tiếp từ năm trước
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => setImporting(true)}>
                  <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  Nhập từ Excel
                </Button>
                <Button size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => setEditing({ item: null })}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  Thêm tài sản
                </Button>
              </>
            )}
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={KanbanSquare}
            title="Chưa có tài sản nào trong kế hoạch."
            description={
              canCreate
                ? "Thêm từng lô đất, nhập cả danh mục từ file Excel đang dùng, hoặc chuyển tiếp tài sản dở dang của năm trước."
                : "Kế hoạch đang khoá danh mục, hoặc bạn chỉ có quyền xem."
            }
            action={canCreate ? <Button onClick={() => setEditing({ item: null })}>Thêm tài sản</Button> : undefined}
          />
        ) : (
          <div className="space-y-4">
            <OwnerFilterBar>
              <OwnerSearchInput
                aria-label="Tìm tài sản trong kế hoạch"
                placeholder="Tìm theo tên lô, mã, số lô…"
                value={term}
                onValueChange={setTerm}
              />
              <OwnerFilterSelect label="Kỳ" value={period} onValueChange={setPeriod}>
                <SelectItem value={ANY}>Tất cả</SelectItem>
                {QUARTERS.map((q) => (
                  <SelectItem key={q} value={String(q)}>
                    {QUARTER_LABELS[q]}
                  </SelectItem>
                ))}
                <SelectItem value={NO_MONTH}>Chưa có tháng</SelectItem>
              </OwnerFilterSelect>
              <OwnerFilterSelect label="Sức khoẻ" value={health} onValueChange={setHealth}>
                <SelectItem value={ANY}>Tất cả</SelectItem>
                {PLAN_ITEM_HEALTH_ORDER.filter((h) => (healthCounts.get(h) ?? 0) > 0).map((h) => (
                  <SelectItem key={h} value={h}>
                    {PLAN_ITEM_HEALTH_LABELS[h]} ({healthCounts.get(h)})
                  </SelectItem>
                ))}
              </OwnerFilterSelect>
            </OwnerFilterBar>

            {shown.length === 0 ? (
              <EmptyState compact icon={KanbanSquare} tone="muted" title="Không có tài sản nào khớp bộ lọc." />
            ) : (
              <PlanItemsTable
                items={shown}
                canEdit={canEdit}
                canDelete={canDelete}
                healthOf={(id) => healthById.get(id)}
                onOpen={(item) => setEditing({ item })}
                onDelete={setDeleting}
              />
            )}
          </div>
        )}
      </SectionCard>

      {editing && (
        <PlanItemDialog
          open
          onOpenChange={(v) => !v && setEditing(null)}
          plan={plan}
          item={editing.item}
          canEdit={canEdit}
        />
      )}
      <DeletePlanItemDialog item={deleting} plan={plan} onOpenChange={(v) => !v && setDeleting(null)} />
      {canCreate && <PlanItemsImportDialog open={importing} onOpenChange={setImporting} plan={plan} />}
      {canCreate && <CarryForwardDialog open={carrying} onOpenChange={setCarrying} plan={plan} />}
    </>
  );
}

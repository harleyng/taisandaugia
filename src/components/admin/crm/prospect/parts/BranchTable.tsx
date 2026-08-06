import { Fragment, useMemo } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor,
  closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical, Link2Off, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import {
  PARENT_RELATION_LABELS,
  prospectSubtypeLabel,
  UNGROUPED_LABEL,
  type ProspectBranch,
  type ProspectGroup,
} from "@/lib/prospects/types";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";
const THR = "px-4 py-2.5 text-right text-xs font-medium text-muted-foreground";
const COLS = 9;

/** Khoá droppable cho rổ "chưa xếp cụm" — null không dùng làm id được. */
const NONE_KEY = "__none";

/** Một khối trong bảng: cụm có tên, hoặc rổ "chưa xếp cụm" ở cuối. */
interface Section {
  key: string;
  title: string;
  group: ProspectGroup | null;
  rows: ProspectBranch[];
}

interface Props {
  branches: ProspectBranch[];
  groups: ProspectGroup[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleMany: (ids: string[], next: boolean) => void;
  onDetach: (b: ProspectBranch) => void;
  onRenameGroup: (g: ProspectGroup) => void;
  onDeleteGroup: (g: ProspectGroup) => void;
  /** Thả xong: chuyển các đơn vị này sang cụm đích (null = bỏ khỏi cụm). */
  onMoveToGroup: (unitIds: string[], groupId: string | null) => void;
  /** Có cụm nào không — quyết định bật kéo thả và hiện dải cụm. */
  grouping: boolean;
  activeDragId: string | null;
  onDragStateChange: (id: string | null) => void;
}

function BranchRow({
  branch, picked, grouping, onToggle, onDetach,
}: {
  branch: ProspectBranch;
  picked: boolean;
  grouping: boolean;
  onToggle: (id: string) => void;
  onDetach: (b: ProspectBranch) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: branch.id,
    data: { branchId: branch.id, groupId: branch.group_id },
    disabled: !grouping,
  });
  // Cả dòng cũng nhận thả, quy về cụm của chính nó — dải tiêu đề quá mỏng để
  // làm vùng thả duy nhất. Id phải khác id draggable nên thêm tiền tố.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `row-${branch.id}`,
    data: { groupId: branch.group_id },
    disabled: !grouping || isDragging,
  });

  const ref = (node: HTMLTableRowElement | null) => {
    setNodeRef(node);
    setDropRef(node);
  };

  return (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border last:border-0 transition-colors",
        isDragging && "opacity-40",
        picked && "bg-primary/5",
        isOver && "bg-primary/10",
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Checkbox
            aria-label={`Chọn ${branch.name}`}
            checked={picked}
            onCheckedChange={() => onToggle(branch.id)}
          />
          {grouping && (
            <button
              type="button"
              aria-label={`Kéo ${branch.name} sang cụm khác`}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-foreground">{branch.name}</span>
        {branch.is_amc && <Badge variant="secondary" className="ml-2 align-middle">AMC</Badge>}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        {prospectSubtypeLabel(branch.subtype)}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">{branch.province || "—"}</td>
      <td className="px-4 py-3 text-right tabular-nums">{branch.listing_count}</td>
      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
        {formatVnd(branch.starting_price_sum)}
      </td>
      <td className="px-4 py-3">
        {/* Quan hệ máy suy ra từ tên có thể sai — nói rõ để admin biết cái nào
            cần rà lại, cái nào người đã xác nhận. */}
        <Badge variant={branch.relation === "confirmed" ? "default" : "outline"}>
          {PARENT_RELATION_LABELS[branch.relation]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <Button size="sm" variant="ghost" onClick={() => onDetach(branch)}>
          <Link2Off className="h-4 w-4 mr-1.5" />
          Gỡ
        </Button>
      </td>
    </tr>
  );
}

function SectionHeader({
  section, allPicked, grouping, onToggleMany, onRenameGroup, onDeleteGroup,
}: {
  section: Section;
  allPicked: boolean;
  grouping: boolean;
  onToggleMany: (ids: string[], next: boolean) => void;
  onRenameGroup: (g: ProspectGroup) => void;
  onDeleteGroup: (g: ProspectGroup) => void;
}) {
  const ids = section.rows.map((b) => b.id);
  // Cả dải cụm là vùng thả — kể cả cụm rỗng, đó là lý do cụm rỗng vẫn render.
  const { setNodeRef, isOver } = useDroppable({
    id: section.group?.id ?? NONE_KEY,
    data: { groupId: section.group?.id ?? null },
    disabled: !grouping,
  });

  return (
    <tr
      ref={setNodeRef}
      className={cn(
        "border-b border-border bg-muted/30 transition-colors",
        isOver && "bg-primary/15 outline outline-2 -outline-offset-2 outline-primary",
      )}
    >
      <td className="px-4 py-2">
        <Checkbox
          aria-label={`Chọn ${section.title}`}
          disabled={ids.length === 0}
          checked={allPicked}
          onCheckedChange={(v) => onToggleMany(ids, v === true)}
        />
      </td>
      <td className="px-4 py-2" colSpan={COLS - 4}>
        <span className="text-xs font-semibold text-foreground">{section.title}</span>
        <span className="text-xs text-muted-foreground ml-2">{section.rows.length} đơn vị</span>
        {isOver && (
          <span className="text-xs text-primary font-medium ml-2">— thả vào đây</span>
        )}
      </td>
      <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
        {section.rows.reduce((n, b) => n + b.listing_count, 0)}
      </td>
      <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground whitespace-nowrap">
        {formatVnd(section.rows.reduce((n, b) => n + Number(b.starting_price_sum || 0), 0))}
      </td>
      <td className="px-4 py-2 text-right whitespace-nowrap">
        {section.group && (
          <>
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              aria-label="Đổi tên cụm"
              onClick={() => onRenameGroup(section.group!)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon" variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              aria-label="Xóa cụm"
              onClick={() => onDeleteGroup(section.group!)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </td>
    </tr>
  );
}

export function BranchTable({
  branches, groups, selected, onToggle, onToggleMany,
  onDetach, onRenameGroup, onDeleteGroup, onMoveToGroup,
  grouping, activeDragId, onDragStateChange,
}: Props) {
  // Cụm rỗng vẫn hiện: admin vừa tạo cụm xong phải thấy nó để kéo chi nhánh vào.
  const sections = useMemo<Section[]>(() => {
    const out: Section[] = groups.map((g) => ({
      key: g.id,
      title: g.name,
      group: g,
      rows: branches.filter((b) => b.group_id === g.id),
    }));
    const rest = branches.filter((b) => !b.group_id);
    if (rest.length > 0 || groups.length === 0) {
      out.push({ key: NONE_KEY, title: UNGROUPED_LABEL, group: null, rows: rest });
    }
    return out;
  }, [branches, groups]);

  const sensors = useSensors(
    // 8px trước khi tính là kéo — nếu không, mỗi cú bấm checkbox đều thành drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // Ưu tiên con trỏ nằm trong vùng nào; hàng bảng cao và sát nhau nên
  // closestCenter một mình hay bắt nhầm dải bên cạnh.
  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    return hits.length > 0 ? hits : closestCenter(args);
  };

  const dragged = activeDragId ? branches.find((b) => b.id === activeDragId) : null;
  // Kéo một dòng đang nằm trong vùng chọn thì chuyển cả vùng chọn.
  const dragIds =
    activeDragId && selected.has(activeDragId) ? [...selected] : activeDragId ? [activeDragId] : [];

  const handleDragEnd = (e: DragEndEvent) => {
    onDragStateChange(null);
    const overData = e.over?.data.current as { groupId: string | null } | undefined;
    if (!e.over || overData === undefined) return;

    const ids =
      selected.has(e.active.id as string) ? [...selected] : [e.active.id as string];
    // Bỏ qua khi mọi dòng đã ở đúng cụm đích — tránh gọi RPC vô ích.
    const moving = branches.filter(
      (b) => ids.includes(b.id) && (b.group_id ?? null) !== overData.groupId,
    );
    if (moving.length === 0) return;
    onMoveToGroup(moving.map((b) => b.id), overData.groupId);
  };

  const table = (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2.5 w-16">
                <Checkbox
                  aria-label="Chọn tất cả"
                  checked={branches.length > 0 && selected.size === branches.length}
                  onCheckedChange={(v) => onToggleMany(branches.map((b) => b.id), v === true)}
                />
              </th>
              <th className={TH}>Tên đơn vị</th>
              <th className={TH}>Hình thức</th>
              <th className={TH}>Tỉnh/Thành phố</th>
              <th className={THR}>Tài sản</th>
              <th className={THR}>Tổng giá khởi điểm</th>
              <th className={TH}>Nguồn quan hệ</th>
              <th className={THR}></th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 ? (
              <tr>
                <td colSpan={COLS} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa ghi nhận đơn vị thành viên nào.
                </td>
              </tr>
            ) : (
              sections.map((s) => {
                const ids = s.rows.map((b) => b.id);
                const allPicked = ids.length > 0 && ids.every((id) => selected.has(id));
                return (
                  <Fragment key={s.key}>
                    {/* Không hiện dải cụm khi công ty mẹ chưa lập cụm nào —
                        bảng phẳng vẫn là mặc định. */}
                    {grouping && (
                      <SectionHeader
                        section={s}
                        allPicked={allPicked}
                        grouping={grouping}
                        onToggleMany={onToggleMany}
                        onRenameGroup={onRenameGroup}
                        onDeleteGroup={onDeleteGroup}
                      />
                    )}

                    {s.rows.length === 0 ? (
                      <tr className="border-b border-border">
                        <td colSpan={COLS} className="px-4 py-4 text-center text-xs text-muted-foreground italic">
                          Cụm này chưa có đơn vị nào.
                        </td>
                      </tr>
                    ) : (
                      s.rows.map((b) => (
                        <BranchRow
                          key={b.id}
                          branch={b}
                          picked={selected.has(b.id)}
                          grouping={grouping}
                          onToggle={onToggle}
                          onDetach={onDetach}
                        />
                      ))
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (!grouping) return table;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(e: DragStartEvent) => onDragStateChange(e.active.id as string)}
      onDragCancel={() => onDragStateChange(null)}
      onDragEnd={handleDragEnd}
    >
      {table}
      <DragOverlay>
        {dragged && (
          <div className="rounded-lg border border-primary/40 bg-card px-3 py-2 shadow-lg flex items-center gap-2 text-sm">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground max-w-[280px] truncate">
              {dragIds.length > 1 ? `${dragIds.length} đơn vị` : dragged.name}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

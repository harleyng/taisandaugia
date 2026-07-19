import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { STAGE_ORDER } from "@/lib/opportunities/opportunityStage";
import { OpportunityColumn } from "./OpportunityColumn";
import { OpportunityCard } from "./OpportunityCard";
import type { Opportunity, OpportunityStage } from "@/types/opportunities";

interface Props {
  opportunities: Opportunity[];
  onOpen: (o: Opportunity) => void;
  /** Thả vào cột thường — đổi giai đoạn ngay (lạc quan). */
  onMove: (o: Opportunity, stage: Exclude<OpportunityStage, "won">) => void;
  /** Thả vào "Thành công" — mở dialog chốt, KHÔNG đổi giai đoạn ngay. */
  onRequestWin: (o: Opportunity) => void;
  /** Thả vào "Thất bại"/"Bị từ chối" — mở dialog hỏi lý do (CHECK ở DB bắt buộc). */
  onRequestLost: (o: Opportunity, stage: "lost" | "rejected") => void;
}

/** Đích thả có thể là chính cột (`stage:<x>`) hoặc một thẻ nằm trong cột. */
function resolveStage(overId: string, byId: Map<string, Opportunity>): OpportunityStage | null {
  if (overId.startsWith("stage:")) return overId.slice(6) as OpportunityStage;
  return byId.get(overId)?.stage ?? null;
}

export function OpportunityBoard({
  opportunities, onOpen, onMove, onRequestWin, onRequestLost,
}: Props) {
  const [dragging, setDragging] = useState<Opportunity | null>(null);

  const sensors = useSensors(
    // Cùng ngưỡng với FolderTree — để click mở chi tiết không bị hiểu là kéo.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const byId = useMemo(
    () => new Map(opportunities.map((o) => [o.id, o])),
    [opportunities],
  );

  const byStage = useMemo(() => {
    const map = new Map<OpportunityStage, Opportunity[]>();
    STAGE_ORDER.forEach((s) => map.set(s, []));
    for (const o of opportunities) map.get(o.stage)?.push(o);
    return map;
  }, [opportunities]);

  const handleDragStart = (e: DragStartEvent) => {
    setDragging(byId.get(String(e.active.id)) ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;

    const item = byId.get(String(active.id));
    if (!item) return;

    const target = resolveStage(String(over.id), byId);
    if (!target || target === item.stage) return;

    // Ba đích cần xác nhận thêm — mỗi cái vì một lý do khác nhau.
    if (target === "won") return onRequestWin(item);
    if (target === "lost" || target === "rejected") return onRequestLost(item, target);

    // Rời khỏi 'won' phải qua bỏ chốt (trigger chặn UPDATE trần) — chặn ở UI
    // trước để không bắn một request chắc chắn lỗi.
    if (item.stage === "won") return onRequestWin(item);

    onMove(item, target as Exclude<OpportunityStage, "won">);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGE_ORDER.map((stage) => (
          <OpportunityColumn
            key={stage}
            stage={stage}
            items={byStage.get(stage) ?? []}
            onOpen={onOpen}
          />
        ))}
      </div>

      {/* Thẻ bay theo con trỏ — không có thì thẻ gốc biến mất lúc kéo. */}
      <DragOverlay>
        {dragging && <OpportunityCard opportunity={dragging} onOpen={onOpen} overlay />}
      </DragOverlay>
    </DndContext>
  );
}

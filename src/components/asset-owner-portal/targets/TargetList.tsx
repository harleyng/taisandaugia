import type { WorkspaceBranchOption } from "@/hooks/useOwnerWorkspaceMembers";
import {
  targetDisplayName,
  targetScopeLabel,
  targetScopeOf,
  type TargetProgress,
  type TargetStatus,
} from "@/lib/ownerTargets";
import { splitInProgress } from "@/lib/ownerTargetView";
import { TargetListRow } from "./TargetListRow";

function GroupLabel({ children }: { children: string }) {
  return (
    <h2 className="flex items-center gap-2 px-0.5 pb-0.5 pt-2.5 text-[12.5px] font-[650] text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-['']">
      {children}
    </h2>
  );
}

interface TargetListProps {
  status: TargetStatus;
  /** Đã lọc + sắp xếp (groupTargetsByStatus). */
  items: TargetProgress[];
  branches: WorkspaceBranchOption[];
  today: string;
}

/**
 * Danh sách thẻ-dòng của một tab. "Đang thực hiện" chia "Kỳ đang diễn ra" và "Sắp tới"
 * (sắp tới gần nhất trước); hai tab đã chốt xếp kỳ mới nhất trước.
 */
export function TargetList({ status, items, branches, today }: TargetListProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl bg-card p-9 text-center text-sm text-muted-foreground shadow-card">
        <b className="mb-1 block text-[15px] text-foreground">Không có chỉ tiêu nào</b>
        Thử đổi bộ lọc phạm vi hoặc loại kỳ.
      </div>
    );
  }

  const row = (p: TargetProgress) => (
    <li key={p.target.id}>
      <TargetListRow
        progress={p}
        name={targetDisplayName(p.target, branches)}
        scopeLabel={targetScopeLabel(targetScopeOf(p.target), branches)}
        today={today}
      />
    </li>
  );

  if (status !== "in_progress") return <ul className="flex flex-col gap-2">{items.map(row)}</ul>;

  const { current, upcoming } = splitInProgress(items, today);
  return (
    <div className="flex flex-col gap-2">
      {current.length > 0 && (
        <section aria-label="Kỳ đang diễn ra" className="flex flex-col gap-2">
          <GroupLabel>{`Kỳ đang diễn ra · ${current.length}`}</GroupLabel>
          <ul className="flex flex-col gap-2">{current.map(row)}</ul>
        </section>
      )}
      {upcoming.length > 0 && (
        <section aria-label="Sắp tới" className="flex flex-col gap-2">
          <GroupLabel>{`Sắp tới · ${upcoming.length}`}</GroupLabel>
          <ul className="flex flex-col gap-2">{upcoming.map(row)}</ul>
        </section>
      )}
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import {
  resolveRelation, RELATION_LABELS, RELATION_BADGE_CLASS, RELATION_PATH,
  type CrmRelated,
} from "@/lib/crm/relation";

/** Ô "Liên quan" dùng chung cho cả Công việc và Ticket ở cổng tập trung. */
export function RelationCell({ row }: { row: CrmRelated }) {
  const navigate = useNavigate();
  const rel = resolveRelation(row);

  if (!rel) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <button
      // Điều hướng bằng useNavigate, KHÔNG dùng asChild+Link (nút biến mất im lặng).
      onClick={(e) => { e.stopPropagation(); navigate(RELATION_PATH[rel.kind]); }}
      className="text-left group/rel"
    >
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${RELATION_BADGE_CLASS[rel.kind]}`}>
        {RELATION_LABELS[rel.kind]}
      </span>
      <span className="block text-xs text-foreground mt-0.5 group-hover/rel:underline truncate max-w-[180px]">
        {rel.label}
      </span>
    </button>
  );
}

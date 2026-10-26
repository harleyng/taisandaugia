// Nhật ký của MỘT kế hoạch đấu giá → dòng thời gian đọc được.
//
// Nguồn là `owner_audit_log` (module `ke-hoach`, bản ghi `auction_plans`), đọc
// qua đúng cổng của trang Nhật ký (`owner_audit_list`). Mỗi lần chuyển bước do
// RPC ghi MỘT dòng, với `changes.status = [trước, sau]` và `meta` kèm số liệu
// (`version`, `item_count`, `changes` = diff bản mốc).
//
// Hàm ở đây THUẦN: nó chỉ dịch cặp trạng thái thành câu tiếng Việt. Luật "ai
// được xem dòng nào" nằm ở SQL, không ở đây.

import { fromServerBaselineDiff, baselineDiffSummary } from "./diff";
import type { AuctionPlanBaselineDiff } from "./types";

/** Tập con của `AuditEntry` mà dòng thời gian cần — `AuditEntry` khớp cấu trúc này. */
export interface PlanHistoryRow {
  id: number;
  created_at: string;
  actor_label: string;
  action: string;
  changes?: Record<string, [unknown, unknown]> | null;
  meta?: Record<string, unknown> | null;
}

export type PlanHistoryKind =
  | "created"
  | "submitted"
  | "returned"
  | "approved"
  | "reopened"
  | "adjusting"
  | "closed"
  | "edited";

export interface PlanHistoryEvent {
  id: number;
  at: string;
  actor: string;
  kind: PlanHistoryKind;
  title: string;
  /** Một dòng chi tiết: số quyết định, góp ý, số tài sản, thay đổi so với bản mốc. */
  detail: string | null;
}

export const PLAN_HISTORY_TONE: Record<PlanHistoryKind, "primary" | "success" | "warning" | "destructive" | "muted"> = {
  created: "muted",
  submitted: "primary",
  returned: "destructive",
  approved: "success",
  reopened: "warning",
  adjusting: "warning",
  closed: "muted",
  edited: "muted",
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "submitted" ← ["draft","submitted"]; dòng không đổi trạng thái ⇒ null. */
function statusPair(row: PlanHistoryRow): [string | null, string | null] | null {
  const pair = row.changes?.status;
  if (!Array.isArray(pair)) return null;
  return [str(pair[0]), str(pair[1])];
}

function kindOf(row: PlanHistoryRow): PlanHistoryKind {
  if (row.action === "create") return "created";
  const pair = statusPair(row);
  if (!pair) return "edited";
  const [from, to] = pair;
  if (to === "submitted") return "submitted";
  if (to === "returned") return "returned";
  if (to === "approved") return "approved";
  if (to === "adjusting") return "adjusting";
  if (to === "closed") return "closed";
  if (to === "draft" && from === "returned") return "reopened";
  return "edited";
}

const TITLES: Record<PlanHistoryKind, string> = {
  created: "Tạo kế hoạch",
  submitted: "Trình lên cấp trên",
  returned: "Cấp trên trả lại",
  approved: "Cấp trên ghi nhận phê duyệt",
  reopened: "Mở lại để sửa",
  adjusting: "Mở điều chỉnh",
  closed: "Đóng kế hoạch",
  edited: "Sửa thông tin kế hoạch",
};

function detailOf(row: PlanHistoryRow, kind: PlanHistoryKind): string | null {
  const meta = row.meta ?? {};
  const parts: string[] = [];

  if (kind === "approved") {
    const docNo = str(row.changes?.approval_doc_no?.[1]);
    const version = int(meta.version);
    if (docNo) parts.push(`Quyết định số ${docNo}`);
    if (version !== null) parts.push(`bản mốc v${version}`);
  }
  if (kind === "returned") {
    const comment = str(row.changes?.review_comment?.[1]);
    if (comment) parts.push(comment);
  }
  if (kind === "submitted") {
    const count = int(meta.item_count);
    if (count !== null) parts.push(`${count} tài sản`);
  }
  if (kind === "approved" || kind === "submitted") {
    const summary = baselineDiffSummary(fromServerBaselineDiff(meta.changes as AuctionPlanBaselineDiff));
    if (summary) parts.push(`thay đổi so với bản mốc: ${summary}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Dòng nhật ký → sự kiện của dòng thời gian, MỚI NHẤT TRƯỚC (như `owner_audit_list` trả về). */
export function planHistoryEvents(rows: readonly PlanHistoryRow[]): PlanHistoryEvent[] {
  return rows.map((row) => {
    const kind = kindOf(row);
    return {
      id: row.id,
      at: row.created_at,
      actor: row.actor_label || "—",
      kind,
      title: TITLES[kind],
      detail: detailOf(row, kind),
    };
  });
}

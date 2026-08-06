// Cây "Chi nhánh/AMC" cho bộ lọc tab Lịch sử đấu giá.
//
// Trên UI, chi nhánh và cụm là HAI CẤP của cùng một cây chứ không phải hai bộ lọc
// rời nhau, nên gộp thành một danh sách phẳng có `level` + cờ vẽ rail. Cấu trúc
// dựng từ chính các dòng lịch sử (không phải từ `branches`) để danh sách chỉ
// hiện đơn vị THỰC SỰ có tin — chọn một mục luôn ra kết quả, không bao giờ rỗng.

import { scopeGroup, scopeUnit } from "./auctionHistory";
import { UNGROUPED_LABEL } from "./types";
import type { AuctionHistoryRow } from "./types";

export interface UnitTreeOption {
  /** Giá trị của HistoryFilters.scope. */
  value: string;
  label: string;
  count: number;
  level: number;
  /** Cờ vẽ rail: mục cuối cùng trong nhóm anh em của nó. */
  isLastChild: boolean;
  /** Với mỗi cấp tổ tiên: tổ tiên đó có phải con út không (để biết còn kẻ dọc). */
  ancestorLastFlags: boolean[];
}

interface UnitAcc {
  id: string;
  name: string;
  groupId: string | null;
  groupName: string | null;
  count: number;
}

/**
 * Gom lịch sử thành cây: cụm ở cấp 0, đơn vị thuộc cụm ở cấp 1. Đơn vị không
 * thuộc cụm nào (trụ sở và chi nhánh chưa xếp) nằm dưới nhánh "Chưa xếp cụm";
 * nếu công ty mẹ chưa lập cụm nào thì bỏ luôn nhánh đó cho danh sách phẳng.
 */
export function buildUnitTree(rows: AuctionHistoryRow[]): UnitTreeOption[] {
  const units = new Map<string, UnitAcc>();
  for (const r of rows) {
    if (!r.unit_id) continue;
    const cur = units.get(r.unit_id) ?? {
      id: r.unit_id, name: r.unit_name,
      groupId: r.group_id, groupName: r.group_name, count: 0,
    };
    cur.count += 1;
    units.set(r.unit_id, cur);
  }
  if (units.size <= 1) return [];

  // Nhiều tin lên trước, hoà thì theo alphabet tiếng Việt.
  const byCount = <T extends { count: number }>(text: (x: T) => string) =>
    (a: T, b: T) => b.count - a.count || text(a).localeCompare(text(b), "vi");
  const byUnit = byCount<UnitAcc>((u) => u.name);

  const grouped = new Map<string, { name: string; count: number; units: UnitAcc[] }>();
  const loose: UnitAcc[] = [];
  for (const u of units.values()) {
    if (!u.groupId) { loose.push(u); continue; }
    const g = grouped.get(u.groupId) ?? { name: u.groupName ?? "", count: 0, units: [] };
    g.count += u.count;
    g.units.push(u);
    grouped.set(u.groupId, g);
  }

  // Nhánh cha: các cụm trước, "Chưa xếp cụm" luôn ở cuối.
  const branches: { value: string; label: string; count: number; children: UnitAcc[] }[] = [
    ...[...grouped.entries()]
      .map(([id, g]) => ({
        value: scopeGroup(id), label: g.name, count: g.count,
        children: [...g.units].sort(byUnit),
      }))
      .sort(byCount((g) => g.label)),
  ];
  if (loose.length > 0 && grouped.size > 0) {
    branches.push({
      value: scopeGroup(null),
      label: UNGROUPED_LABEL,
      count: loose.reduce((n, u) => n + u.count, 0),
      children: [...loose].sort(byUnit),
    });
  }

  const out: UnitTreeOption[] = [];

  // Chưa có cụm nào → danh sách phẳng các đơn vị, không dựng cấp thừa.
  if (grouped.size === 0) {
    for (const [i, u] of [...loose].sort(byUnit).entries()) {
      out.push({
        value: scopeUnit(u.id), label: u.name, count: u.count, level: 0,
        isLastChild: i === loose.length - 1, ancestorLastFlags: [],
      });
    }
    return out;
  }

  branches.forEach((b, bi) => {
    const bLast = bi === branches.length - 1;
    out.push({
      value: b.value, label: b.label, count: b.count, level: 0,
      isLastChild: bLast, ancestorLastFlags: [],
    });
    b.children.forEach((u, ui) => {
      out.push({
        value: scopeUnit(u.id), label: u.name, count: u.count, level: 1,
        isLastChild: ui === b.children.length - 1, ancestorLastFlags: [bLast],
      });
    });
  });

  return out;
}

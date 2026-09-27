// Đọc câu chữ slot từ JSONB mẫu (không tin hình dạng dữ liệu) + chuyển qua lại
// giữa giá trị slot và ô nhập của trang soạn mẫu.

import {
  PLACEHOLDER_MARK,
  templateTypeDef,
  type ClauseMap,
  type SlotValue,
  type TemplateSlot,
} from "./schema";

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Một slot dạng đoạn văn; rỗng / sai kiểu ⇒ fallback. */
export function slotText(clauses: unknown, key: string, fallback = ""): string {
  const v = asRecord(clauses)[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v)) {
    const joined = v.filter((x) => typeof x === "string" && x.trim()).join(" ").trim();
    if (joined) return joined;
  }
  return fallback;
}

/** Một slot dạng danh sách; rỗng / sai kiểu ⇒ fallback. */
export function slotList(clauses: unknown, key: string, fallback: readonly string[] = []): string[] {
  const v = asRecord(clauses)[key];
  if (Array.isArray(v)) {
    const items = v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
    if (items.length) return items;
  }
  if (typeof v === "string" && v.trim()) return splitLines(v);
  return [...fallback];
}

/**
 * Đủ mọi slot của một loại: giá trị trong DB, thiếu thì mặc định TS của loại đó.
 * Loại lạ ⇒ trả nguyên những gì đọc được (không bịa slot).
 */
export function resolveClauses(type: string, clauses: unknown): ClauseMap {
  const def = templateTypeDef(type);
  if (!def) return { ...(asRecord(clauses) as ClauseMap) };
  const out: ClauseMap = {};
  for (const slot of def.slots) {
    const fb = def.defaults[slot.key];
    out[slot.key] =
      slot.kind === "list"
        ? slotList(clauses, slot.key, Array.isArray(fb) ? fb : fb ? [fb] : [])
        : slotText(clauses, slot.key, typeof fb === "string" ? fb : Array.isArray(fb) ? fb.join(" ") : "");
  }
  return out;
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]\s+/, "").trim())
    .filter(Boolean);
}

/** Giá trị slot → nội dung ô nhập (danh sách: mỗi dòng một mục). */
export function slotToInput(slot: TemplateSlot, value: SlotValue | undefined): string {
  if (value === undefined) return "";
  if (slot.kind === "list") return (Array.isArray(value) ? value : splitLines(value)).join("\n");
  return Array.isArray(value) ? value.join(" ") : value;
}

/** Ô nhập → giá trị slot để lưu. */
export function inputToSlot(slot: TemplateSlot, input: string): SlotValue {
  return slot.kind === "list" ? splitLines(input) : input.trim();
}

/** Slot còn trống (bắt buộc điền mới lưu được bản mới). */
export function emptySlots(slots: readonly TemplateSlot[], values: ClauseMap): TemplateSlot[] {
  return slots.filter((s) => {
    const v = values[s.key];
    return Array.isArray(v) ? v.length === 0 : !v || !v.trim();
  });
}

/** Slot còn dấu "[CẦN NHẬP]" — cảnh báo, không chặn. */
export function placeholderSlots(type: string, clauses: unknown): TemplateSlot[] {
  const def = templateTypeDef(type);
  if (!def) return [];
  const rec = asRecord(clauses);
  return def.slots.filter((s) => {
    const v = rec[s.key];
    const text = Array.isArray(v) ? v.join("\n") : typeof v === "string" ? v : "";
    return text.includes(PLACEHOLDER_MARK);
  });
}

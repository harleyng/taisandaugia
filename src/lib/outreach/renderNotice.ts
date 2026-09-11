// Dựng thông báo đấu giá từ MẪU KHOÁ + giá trị ô. Câu chữ khoá chép nguyên văn;
// giá trị ô chỉ là văn bản thường — không nội suy, không có cú pháp placeholder,
// nên nội dung ô không thể chen vào / sửa điều khoản.

import {
  slotLabel,
  type CaseSlotKey,
  type DraftSlotKey,
  type FactSlotKey,
  type NoticeSlotSource,
  type NoticeTemplate,
} from "./noticeTemplate";

export interface NoticeValues {
  facts: Partial<Record<FactSlotKey, string>>;
  cases: Partial<Record<CaseSlotKey, string>>;
  drafts: Partial<Record<DraftSlotKey, string>>;
}

export interface RenderedSlot {
  source: NoticeSlotSource;
  key: string;
  label: string;
  value: string;
  required: boolean;
  missing: boolean;
}

export type RenderedBlock =
  | { kind: "heading" | "clause"; text: string }
  | { kind: "field"; label: string; slots: RenderedSlot[] };

export interface RenderedNotice {
  blocks: RenderedBlock[];
  text: string;
  missing: RenderedSlot[];
}

const pick = (values: NoticeValues, source: NoticeSlotSource, key: string): string => {
  const bag = source === "fact" ? values.facts : source === "case" ? values.cases : values.drafts;
  return ((bag as Record<string, string | undefined>)[key] ?? "").trim();
};

export function renderNotice(template: NoticeTemplate, values: NoticeValues): RenderedNotice {
  const blocks: RenderedBlock[] = template.blocks.map((b) => {
    if (b.kind !== "field") return { kind: b.kind, text: b.text };
    return {
      kind: "field",
      label: b.label,
      slots: b.slots.map((s) => {
        const value = pick(values, s.source, s.key);
        return {
          source: s.source,
          key: s.key,
          label: slotLabel(s.source, s.key),
          value,
          required: s.required,
          missing: s.required && value === "",
        };
      }),
    };
  });

  const lines = blocks.map((b) => {
    if (b.kind !== "field") return b.text;
    const filled = b.slots.map((s) => s.value).filter(Boolean);
    return `${b.label}: ${filled.length ? filled.join("\n") : "……"}`;
  });

  const missing = blocks.flatMap((b) => (b.kind === "field" ? b.slots.filter((s) => s.missing) : []));
  return { blocks, text: lines.join("\n\n"), missing };
}

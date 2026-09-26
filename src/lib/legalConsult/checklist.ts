// Luật checklist — NHÂN BẢN _legal_consult_replace_items(_strict) ở migration
// 20260915000030 để báo lỗi ngay trên form; server vẫn là nơi quyết định.

import type { ChecklistDraftItem, ChecklistItemStatus, LegalConsultationItem } from "@/types/legalConsult";
import { ITEM_STATUS_ORDER } from "./status";
import { templateFor } from "./checklistTemplates";

export const MAX_CHECKLIST_ITEMS = 80;

export type ChecklistIssue =
  | { kind: "empty" }
  | { kind: "too_many" }
  | { kind: "label"; index: number }
  | { kind: "unmarked"; index: number }
  | { kind: "action_required"; index: number };

/** strict = lúc hoàn tất (mọi mục phải chấm, mục khác "Đủ" phải có việc cần làm). */
export function validateChecklist(items: ChecklistDraftItem[], strict: boolean): ChecklistIssue[] {
  const issues: ChecklistIssue[] = [];
  if (strict && items.length === 0) issues.push({ kind: "empty" });
  if (items.length > MAX_CHECKLIST_ITEMS) issues.push({ kind: "too_many" });
  items.forEach((it, index) => {
    const label = it.label.trim();
    if (label.length < 2 || label.length > 300) issues.push({ kind: "label", index });
    if (strict && !it.status) issues.push({ kind: "unmarked", index });
    if (strict && it.status && it.status !== "sufficient" && it.required_action.trim().length < 5) {
      issues.push({ kind: "action_required", index });
    }
  });
  return issues;
}

export function issueMessage(issue: ChecklistIssue): string {
  switch (issue.kind) {
    case "empty":
      return "Checklist cần ít nhất một mục.";
    case "too_many":
      return `Checklist tối đa ${MAX_CHECKLIST_ITEMS} mục.`;
    case "label":
      return `Mục ${issue.index + 1}: tên mục từ 2–300 ký tự.`;
    case "unmarked":
      return `Mục ${issue.index + 1}: chưa chấm Đủ / Thiếu / Cần làm rõ.`;
    case "action_required":
      return `Mục ${issue.index + 1}: ghi rõ người bán cần bổ sung / làm rõ gì (ít nhất 5 ký tự).`;
  }
}

/** Mục người bán phải xử lý — Thiếu trước, Cần làm rõ sau. */
export function itemsNeedingAction<T extends Pick<LegalConsultationItem, "status" | "sort_order">>(items: T[]): T[] {
  return sortItemsForSeller(items).filter((i) => i.status && i.status !== "sufficient");
}

export function sortItemsForSeller<T extends Pick<LegalConsultationItem, "status" | "sort_order">>(items: T[]): T[] {
  const rank = (s: string | null) => {
    const i = ITEM_STATUS_ORDER.indexOf(s as ChecklistItemStatus);
    return i === -1 ? ITEM_STATUS_ORDER.length : i;
  };
  return [...items].sort((a, b) => rank(a.status) - rank(b.status) || a.sort_order - b.sort_order);
}

export function countByStatus(items: Pick<LegalConsultationItem, "status">[]): Record<ChecklistItemStatus, number> {
  const out: Record<ChecklistItemStatus, number> = { sufficient: 0, missing: 0, needs_clarification: 0 };
  for (const i of items) if (i.status && i.status in out) out[i.status as ChecklistItemStatus] += 1;
  return out;
}

/** Nháp checklist: bản đã lưu (nếu có) hoặc mẫu theo nhóm tài sản. */
export function initialDraft(saved: LegalConsultationItem[], parentSlug: string | null): ChecklistDraftItem[] {
  if (saved.length > 0) {
    return [...saved]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        template_key: i.template_key,
        label: i.label,
        status: (i.status as ChecklistItemStatus | null) ?? null,
        expert_note: i.expert_note ?? "",
        required_action: i.required_action ?? "",
        doc_paths: i.doc_paths ?? [],
      }));
  }
  return templateFor(parentSlug).map((t): ChecklistDraftItem => ({
    template_key: t.key,
    label: t.label,
    status: null,
    expert_note: "",
    required_action: "",
    doc_paths: [],
  }));
}

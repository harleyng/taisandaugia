import { describe, expect, it } from "vitest";
import { countByStatus, initialDraft, itemsNeedingAction, validateChecklist } from "./checklist";
import { templateFor } from "./checklistTemplates";
import { summarizeConsultations, tvplStepIndex } from "./status";
import type { ChecklistDraftItem, LegalConsultation, LegalConsultationItem } from "@/types/legalConsult";

const draft = (extra: Partial<ChecklistDraftItem> = {}): ChecklistDraftItem => ({
  template_key: null,
  label: "Giấy chứng nhận QSDĐ",
  status: "sufficient",
  expert_note: "",
  required_action: "",
  doc_paths: [],
  ...extra,
});

const row = (id: string, status: string, version: number | null = null) =>
  ({ id, status, version, created_at: id }) as unknown as LegalConsultation;

const item = (status: string | null, sort_order: number) =>
  ({ id: `${status}-${sort_order}`, status, sort_order }) as unknown as LegalConsultationItem;

describe("validateChecklist (nhân bản _legal_consult_replace_items)", () => {
  it("lưu nháp cho phép mục chưa chấm, hoàn tất thì không", () => {
    const items = [draft({ status: null })];
    expect(validateChecklist(items, false)).toEqual([]);
    expect(validateChecklist(items, true)).toEqual([{ kind: "unmarked", index: 0 }]);
  });

  it("mục Thiếu / Cần làm rõ bắt buộc có việc cần làm ≥ 5 ký tự khi hoàn tất", () => {
    const items = [draft({ status: "missing", required_action: "abc" }), draft({ status: "needs_clarification" })];
    expect(validateChecklist(items, true)).toEqual([
      { kind: "action_required", index: 0 },
      { kind: "action_required", index: 1 },
    ]);
    expect(validateChecklist([draft({ status: "missing", required_action: "Bổ sung bản gốc" })], true)).toEqual([]);
  });

  it("checklist rỗng chỉ chặn lúc hoàn tất; tên mục phải 2–300 ký tự", () => {
    expect(validateChecklist([], false)).toEqual([]);
    expect(validateChecklist([], true)).toEqual([{ kind: "empty" }]);
    expect(validateChecklist([draft({ label: " x " })], false)).toEqual([{ kind: "label", index: 0 }]);
  });
});

describe("checklist cho người bán", () => {
  it("việc cần làm lên đầu: Thiếu → Cần làm rõ, bỏ mục Đủ", () => {
    const items = [item("sufficient", 1), item("needs_clarification", 2), item("missing", 3), item("missing", 4)];
    expect(itemsNeedingAction(items).map((i) => i.id)).toEqual(["missing-3", "missing-4", "needs_clarification-2"]);
    expect(countByStatus(items)).toEqual({ sufficient: 1, missing: 2, needs_clarification: 1 });
  });

  it("nháp mới nạp mẫu theo nhóm; nhóm lạ dùng mẫu mặc định", () => {
    const bds = initialDraft([], "bat-dong-san");
    expect(bds[0]).toMatchObject({ template_key: "land_certificate", status: null });
    expect(templateFor("nhom-khong-ton-tai").length).toBeGreaterThan(0);
    expect(templateFor(null)).toEqual(templateFor("khong-co"));
  });
});

describe("summarizeConsultations (BR-CNS-03)", () => {
  it("tách lần đang chạy, kết quả hiện hành và lịch sử phiên bản mới nhất trước", () => {
    const rows = [row("c", "requested"), row("b", "completed", 2), row("a", "superseded", 1), row("x", "cancelled")];
    const s = summarizeConsultations(rows);
    expect(s.active?.id).toBe("c");
    expect(s.current?.id).toBe("b");
    expect(s.versions.map((v) => v.version)).toEqual([2, 1]);
  });

  it("stepper: superseded / cancelled không nằm trên luồng", () => {
    expect(tvplStepIndex("in_review")).toBe(3);
    expect(tvplStepIndex("superseded")).toBe(-1);
  });
});

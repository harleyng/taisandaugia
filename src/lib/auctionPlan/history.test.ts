import { describe, expect, it } from "vitest";
import { planHistoryEvents, type PlanHistoryRow } from "./history";

const row = (over: Partial<PlanHistoryRow>): PlanHistoryRow => ({
  id: 1,
  created_at: "2026-10-20T03:00:00Z",
  actor_label: "Nguyễn Văn A",
  action: "update",
  changes: null,
  meta: null,
  ...over,
});

describe("planHistoryEvents", () => {
  it("đọc cặp trạng thái thành từng bước của luồng duyệt", () => {
    const events = planHistoryEvents([
      row({ id: 6, changes: { status: ["approved", "adjusting"] } }),
      row({ id: 5, changes: { status: ["submitted", "approved"] }, meta: { version: 1 } }),
      row({ id: 4, changes: { status: ["draft", "submitted"] }, meta: { item_count: 6 } }),
      row({ id: 3, changes: { status: ["returned", "draft"] } }),
      row({ id: 2, changes: { status: ["submitted", "returned"] } }),
      row({ id: 1, action: "create" }),
    ]);
    expect(events.map((e) => e.kind)).toEqual([
      "adjusting",
      "approved",
      "submitted",
      "reopened",
      "returned",
      "created",
    ]);
  });

  it("phê duyệt: số quyết định + số bản mốc", () => {
    const [e] = planHistoryEvents([
      row({
        changes: { status: ["submitted", "approved"], approval_doc_no: [null, "1234/QĐ-UBND"] },
        meta: { version: 2 },
      }),
    ]);
    expect(e.title).toBe("Cấp trên ghi nhận phê duyệt");
    expect(e.detail).toBe("Quyết định số 1234/QĐ-UBND · bản mốc v2");
  });

  it("trả lại: hiện nguyên góp ý", () => {
    const [e] = planHistoryEvents([
      row({ changes: { status: ["submitted", "returned"], review_comment: [null, "Bổ sung diện tích lô LK2"] } }),
    ]);
    expect(e.detail).toBe("Bổ sung diện tích lô LK2");
  });

  it("trình bản điều chỉnh: số tài sản + thay đổi so với bản mốc", () => {
    const [e] = planHistoryEvents([
      row({
        changes: { status: ["adjusting", "submitted"] },
        meta: {
          item_count: 7,
          changes: { baseline: true, added: ["KH26-007"], dropped: [], moved_quarter: ["KH26-001"], value_shift: [] },
        },
      }),
    ]);
    expect(e.detail).toBe("7 tài sản · thay đổi so với bản mốc: Thêm 1 · Dời quý 1");
  });

  it("dòng không đổi trạng thái ⇒ 'Sửa thông tin kế hoạch'", () => {
    const [e] = planHistoryEvents([row({ changes: { title: ["A", "B"] } })]);
    expect(e.kind).toBe("edited");
    expect(e.detail).toBeNull();
  });

  it("thiếu tên người làm ⇒ gạch ngang, không để trống", () => {
    expect(planHistoryEvents([row({ actor_label: "" })])[0].actor).toBe("—");
  });
});

import { describe, expect, it } from "vitest";
import * as consignment from "@/lib/consignment/contract-pdf/clauses";
import { TEMPLATE_TYPES, templateTypeDef } from "./schema";
import { emptySlots, inputToSlot, placeholderSlots, resolveClauses, slotList, slotText, slotToInput, splitLines } from "./resolve";

describe("slot đọc từ JSONB mẫu", () => {
  it("thiếu / sai kiểu / rỗng ⇒ lùi về mặc định", () => {
    expect(slotList(null, "legal_bases", ["a"])).toEqual(["a"]);
    expect(slotList({ legal_bases: [] }, "legal_bases", ["a"])).toEqual(["a"]);
    expect(slotList({ legal_bases: 42 }, "legal_bases", ["a"])).toEqual(["a"]);
    expect(slotText({ payment_terms: "   " }, "payment_terms", "mặc định")).toBe("mặc định");
  });

  it("chuỗi nhiều dòng đọc được như danh sách, danh sách đọc được như đoạn", () => {
    expect(slotList({ x: "- một\n• hai\n\nba" }, "x")).toEqual(["một", "hai", "ba"]);
    expect(slotText({ x: ["câu 1.", "câu 2."] }, "x")).toBe("câu 1. câu 2.");
  });

  it("mẫu ký gửi trống ⇒ đúng hằng số cũ (bản in không đổi khi chưa có mẫu DB)", () => {
    const r = resolveClauses("consignment", {});
    expect(r.legal_bases).toEqual(consignment.LEGAL_BASES);
    expect(r.payment_terms).toBe(consignment.PAYMENT_TERMS);
    expect(r.draft_notice).toBe(consignment.DRAFT_NOTICE);
  });

  it("DB đè từng slot, slot khác vẫn mặc định", () => {
    const r = resolveClauses("consignment", { payment_terms: "Thanh toán trong 5 ngày." });
    expect(r.payment_terms).toBe("Thanh toán trong 5 ngày.");
    expect(r.owner_duties).toEqual(consignment.OWNER_DUTIES);
  });
});

describe("ô nhập ↔ slot", () => {
  const listSlot = templateTypeDef("consignment")!.slots.find((s) => s.key === "legal_bases")!;
  const textSlot = templateTypeDef("consignment")!.slots.find((s) => s.key === "payment_terms")!;

  it("danh sách: mỗi dòng một mục, bỏ dòng trống và gạch đầu dòng", () => {
    expect(inputToSlot(listSlot, "- A\n\n  B  \n")).toEqual(["A", "B"]);
    expect(slotToInput(listSlot, ["A", "B"])).toBe("A\nB");
    expect(splitLines("* x\n- y")).toEqual(["x", "y"]);
  });

  it("đoạn văn giữ nguyên, chỉ cắt khoảng trắng hai đầu", () => {
    expect(inputToSlot(textSlot, "  Một đoạn.  ")).toBe("Một đoạn.");
  });

  it("slot trống bị chặn lưu", () => {
    const slots = [listSlot, textSlot];
    expect(emptySlots(slots, { legal_bases: [], payment_terms: "x" }).map((s) => s.key)).toEqual(["legal_bases"]);
  });
});

describe("schema", () => {
  it("mọi loại mẫu có key slot duy nhất", () => {
    for (const d of TEMPLATE_TYPES) {
      const keys = d.slots.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("dấu [CẦN NHẬP] được báo theo slot", () => {
    expect(placeholderSlots("service:vr-tour", { provider_name: "[CẦN NHẬP] Tên", scope: ["ok"] }).map((s) => s.key)).toEqual([
      "provider_name",
    ]);
    expect(placeholderSlots("sale", { legal_bases: ["ok"] })).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { caseLot, legalSummaryFromFlags, parseCaseFile, prefillCaseFile } from "./caseFile";

describe("caseFile", () => {
  it("jsonb hỏng rơi về giá trị rỗng, không ném lỗi", () => {
    const cf = parseCaseFile({ owner_info: 42, lots: "x", contact_person: "Chị Lan" });
    expect(cf.owner_info).toBe("");
    expect(cf.lots).toEqual({});
    expect(cf.contact_person).toBe("Chị Lan");
    expect(parseCaseFile(null).owner_info).toBe("");
  });

  it("tóm tắt cờ pháp lý, bỏ qua cờ chưa khai", () => {
    expect(legalSummaryFromFlags({ has_dispute: false, has_mortgage: true, is_seized: null })).toBe(
      "Theo khai báo của chủ tài sản: không có tranh chấp, đang thế chấp.",
    );
    expect(legalSummaryFromFlags({ has_dispute: null, has_mortgage: null, is_seized: null })).toBe("");
  });

  it("điền sẵn chỉ vào ô còn trống, không ghi đè thứ tổ chức đã nhập", () => {
    const cf = parseCaseFile({ lots: { L1: { description: "Tổ chức tự viết" } } });
    const next = prefillCaseFile(
      cf,
      [
        { id: "L1", listing_id: "listing-1", asset_posting_id: null, image_url: "https://img/lot1.jpg" },
        { id: "L2", listing_id: null, asset_posting_id: "posting-2", image_url: null },
      ],
      [{ id: "listing-1", description: "Mô tả tin đăng", legal_status: "Sổ hồng riêng", image_url: "https://img/l1.jpg" }],
      [
        {
          posting_id: "posting-2",
          description: "Mô tả ký gửi",
          image_urls: ["https://img/p2a.jpg", "https://img/p2b.jpg"],
          has_dispute: false,
          has_mortgage: false,
          is_seized: false,
        },
      ],
    );
    expect(caseLot(next, "L1")).toMatchObject({
      description: "Tổ chức tự viết",
      legal_summary: "Sổ hồng riêng",
      photo_urls: ["https://img/lot1.jpg", "https://img/l1.jpg"],
    });
    expect(caseLot(next, "L2")).toMatchObject({
      description: "Mô tả ký gửi",
      legal_summary: "Theo khai báo của chủ tài sản: không có tranh chấp, không thế chấp, không bị kê biên.",
    });
  });
});

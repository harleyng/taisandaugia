import { describe, expect, it } from "vitest";
import type { AssetPosting } from "@/types/asset-posting";
import {
  auctionNeedsDeclared,
  commissionLabel,
  declarationRows,
  formatFileSize,
  galleryLayout,
  legalDeclared,
  postingDocs,
  statusBand,
  verificationCode,
} from "./postingPrint";

const base = {
  id: "7f3cab12-0000-4000-8000-000000000001",
  code: "HS-0142",
  status: "active",
  created_at: "2026-09-12T03:00:00Z",
  starting_price: null,
  commission_pct: null,
  expected_timeline: null,
  right_to_sell: false,
  has_dispute: null,
  has_mortgage: null,
  is_seized: null,
  ownership_declaration: null,
  ownership_proof_urls: [],
  doc_urls: [],
} as unknown as AssetPosting;

describe("galleryLayout", () => {
  it("≥9 ảnh in 9, ≥5 in 5, ít hơn in hết và báo thiếu", () => {
    expect(galleryLayout(14)).toEqual({ shown: 9, miss: 0, big: true });
    expect(galleryLayout(6)).toEqual({ shown: 5, miss: 0, big: true });
    expect(galleryLayout(3)).toEqual({ shown: 3, miss: 2, big: false });
    expect(galleryLayout(0)).toEqual({ shown: 0, miss: 5, big: false });
  });
});

describe("verificationCode", () => {
  it("mã hồ sơ + 4 ký tự id + ngày tạo", () => {
    expect(verificationCode(base)).toBe("HS-0142-7F3C-12092026");
  });
});

describe("statusBand", () => {
  it("dải theo trạng thái trước duyệt, không có sau duyệt", () => {
    expect(statusBand("draft", 60, null)?.title).toBe("Bản nháp · hoàn thiện 60%");
    expect(statusBand("review", 100, null)?.title).toBe("Đang chờ sàn duyệt");
    expect(statusBand("rejected", 100, "Ảnh mờ")).toMatchObject({ tone: "err", text: "Ảnh mờ" });
    expect(statusBand("ready", 100, null)).toBeNull();
  });
});

describe("khai báo", () => {
  it("nháp trống thì chưa khai nhu cầu / pháp lý", () => {
    const draft = { ...base, status: "draft" } as AssetPosting;
    expect(auctionNeedsDeclared(draft)).toBe(false);
    expect(legalDeclared(draft)).toBe(false);
    expect(auctionNeedsDeclared({ ...draft, starting_price: 1 })).toBe(true);
    expect(legalDeclared({ ...draft, has_dispute: false })).toBe(true);
  });

  it("câu vướng trả lời Có là err", () => {
    const rows = declarationRows({ ...base, right_to_sell: true, has_mortgage: true, has_dispute: false });
    expect(rows.map((r) => r.tone)).toEqual(["ok", "ok", "err", "mu"]);
  });
});

describe("định dạng", () => {
  it("dung lượng tệp dấu phẩy thập phân", () => {
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe("2,4 MB");
    expect(formatFileSize(800 * 1024)).toBe("800 KB");
    expect(formatFileSize(null)).toBeNull();
  });

  it("thù lao dấu phẩy thập phân", () => {
    expect(commissionLabel(1.5)).toBe("≤ 1,5%");
    expect(commissionLabel(null)).toBe("—");
  });

  it("giấy tờ đặt tên theo loại", () => {
    const docs = postingDocs({ ...base, ownership_proof_urls: ["u/a.pdf"], doc_urls: ["u/b.jpg"] });
    expect(docs.map((d) => [d.name, d.ext, d.kind])).toEqual([
      ["Giấy tờ sở hữu 1", "PDF", "Giấy tờ sở hữu"],
      ["Tài liệu bổ sung 1", "JPG", "Giấy tờ khác"],
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { isPdfPath, kycExtOf, kycFileError, KYC_MAX_BYTES } from "./kycFile";

describe("kycFileError", () => {
  it("ảnh giấy tờ chỉ nhận JPG/PNG", () => {
    expect(kycFileError({ type: "image/jpeg", size: 1000 }, "image")).toBeNull();
    expect(kycFileError({ type: "image/png", size: 1000 }, "image")).toBeNull();
    expect(kycFileError({ type: "application/pdf", size: 1000 }, "image")).toMatch(/JPG hoặc PNG/);
    expect(kycFileError({ type: "image/heic", size: 1000 }, "image")).toMatch(/JPG hoặc PNG/);
  });

  it("tài liệu nhận thêm PDF", () => {
    expect(kycFileError({ type: "application/pdf", size: 1000 }, "document")).toBeNull();
    expect(kycFileError({ type: "image/webp", size: 1000 }, "document")).toMatch(/PDF/);
  });

  it("chặn tệp quá 10 MB và tệp rỗng", () => {
    expect(kycFileError({ type: "image/png", size: KYC_MAX_BYTES }, "image")).toBeNull();
    expect(kycFileError({ type: "image/png", size: KYC_MAX_BYTES + 1 }, "image")).toMatch(/10 MB/);
    expect(kycFileError({ type: "image/png", size: 0 }, "image")).toMatch(/rỗng/);
  });
});

describe("helpers", () => {
  it("kycExtOf theo MIME", () => {
    expect(kycExtOf("image/jpeg")).toBe("jpg");
    expect(kycExtOf("image/png")).toBe("png");
    expect(kycExtOf("application/pdf")).toBe("pdf");
  });

  it("isPdfPath", () => {
    expect(isPdfPath("u1/abc.PDF")).toBe(true);
    expect(isPdfPath("u1/abc.jpg")).toBe(false);
  });
});

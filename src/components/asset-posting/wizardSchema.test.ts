import { describe, it, expect } from "vitest";
import {
  requirements,
  buildPostingPayload,
  signatureFilled,
  wizardDefaults,
  type WizardValues,
} from "./wizardSchema";

/** Hồ sơ hợp lệ tối thiểu; mỗi test chỉ đổi phần nó quan tâm. */
const mk = (over: Partial<WizardValues> = {}): WizardValues => ({
  ...wizardDefaults,
  parentSlug: "bat-dong-san",
  childSlug: "dat-o",
  title: "Lô đất mặt tiền",
  province: "TP. Hồ Chí Minh",
  imageUrls: ["https://example.test/a.jpg"],
  ...over,
});

const missingKeys = (v: WizardValues) => requirements(v).filter((r) => !r.ok).map((r) => r.key);

describe("signatureFilled", () => {
  it("từ chối tên một từ — 'abc' qua min-length nhưng không phải họ tên", () => {
    expect(signatureFilled("abc")).toBe(false);
    expect(signatureFilled("   Nguyen   ")).toBe(false);
    expect(signatureFilled("")).toBe(false);
  });

  it("chấp nhận họ tên từ 2 từ trở lên, bỏ qua khoảng trắng thừa", () => {
    expect(signatureFilled("Nguyễn Văn A")).toBe(true);
    expect(signatureFilled("  Trần   Thị  B  ")).toBe(true);
  });
});

describe("requirements — ảnh bắt buộc mọi nhóm", () => {
  it.each(["bat-dong-san", "xe-co", "may-moc", "hang-hoa", "do-dung"])(
    "nhóm %s thiếu ảnh ⇒ chặn ở bước 2",
    (parentSlug) => {
      const v = mk({ parentSlug, childSlug: "x", imageUrls: [] });
      const imageReq = requirements(v).find((r) => r.key === "imageUrls");
      expect(imageReq).toMatchObject({ step: 2, ok: false });
    },
  );

  it("có 1 ảnh là đủ", () => {
    expect(missingKeys(mk())).not.toContain("imageUrls");
  });

  it("video không thay được ảnh", () => {
    const v = mk({ imageUrls: [], videoUrls: ["https://example.test/a.mp4"] });
    expect(missingKeys(v)).toContain("imageUrls");
  });
});

describe("requirements — chứng minh sở hữu theo nhóm cấp 1", () => {
  it("bất động sản đòi giấy tờ, KHÔNG đòi cam kết", () => {
    const keys = missingKeys(mk({ ownershipProofUrls: [] }));
    expect(keys).toContain("ownershipProofUrls");
    expect(keys).not.toContain("ownershipDeclaration");
  });

  it("xe cộ đòi giấy tờ", () => {
    const v = mk({ parentSlug: "xe-co", childSlug: "o-to", ownershipProofUrls: [] });
    expect(missingKeys(v)).toContain("ownershipProofUrls");
  });

  it("máy móc KHÔNG đòi giấy tờ, đòi cam kết", () => {
    const v = mk({ parentSlug: "may-moc", childSlug: "may-cong-trinh", ownershipProofUrls: [] });
    const keys = missingKeys(v);
    expect(keys).not.toContain("ownershipProofUrls");
    expect(keys).toContain("ownershipDeclaration");
  });

  it("máy móc đã ký hợp lệ ⇒ bước 3 không còn thiếu phần sở hữu", () => {
    const v = mk({
      parentSlug: "may-moc",
      childSlug: "may-cong-trinh",
      ownershipProofUrls: [],
      declarationAccepted: true,
      declarationName: "Nguyễn Văn A",
    });
    const keys = missingKeys(v);
    expect(keys).not.toContain("ownershipDeclaration");
    expect(keys).not.toContain("ownershipProofUrls");
  });

  it("tích checkbox nhưng tên một từ ⇒ vẫn thiếu", () => {
    const v = mk({
      parentSlug: "hang-hoa",
      childSlug: "sat-thep",
      declarationAccepted: true,
      declarationName: "Nguyen",
    });
    expect(missingKeys(v)).toContain("ownershipDeclaration");
  });

  it("nhập tên nhưng chưa tích checkbox ⇒ vẫn thiếu", () => {
    const v = mk({
      parentSlug: "do-dung",
      childSlug: "noi-that",
      declarationAccepted: false,
      declarationName: "Nguyễn Văn A",
    });
    expect(missingKeys(v)).toContain("ownershipDeclaration");
  });

  it("slug lạ rơi về 'documents' — đoán sai theo hướng chặt", () => {
    const v = mk({ parentSlug: "khong-ton-tai", childSlug: "x", ownershipProofUrls: [] });
    expect(missingKeys(v)).toContain("ownershipProofUrls");
  });
});

describe("buildPostingPayload — bản cam kết", () => {
  it("nhóm dùng giấy tờ ⇒ ownership_declaration null kể cả khi field cam kết đang bẩn", () => {
    const v = mk({
      parentSlug: "xe-co",
      childSlug: "o-to",
      declarationAccepted: true,
      declarationName: "Nguyễn Văn A",
    });
    expect(buildPostingPayload(v).ownership_declaration).toBeNull();
  });

  it("nhóm dùng cam kết ⇒ lưu name/accepted_at/version, tên đã trim", () => {
    const v = mk({
      parentSlug: "may-moc",
      childSlug: "may-cong-trinh",
      declarationAccepted: true,
      declarationName: "  Nguyễn Văn A  ",
    });
    const decl = buildPostingPayload(v).ownership_declaration as unknown as Record<string, string>;
    expect(decl.name).toBe("Nguyễn Văn A");
    expect(decl.version).toBeTruthy();
    expect(Number.isNaN(Date.parse(decl.accepted_at))).toBe(false);
  });

  it("chưa ký xong ⇒ null, không lưu cam kết dở dang", () => {
    const v = mk({ parentSlug: "may-moc", childSlug: "may-cong-trinh", declarationAccepted: true, declarationName: "A" });
    expect(buildPostingPayload(v).ownership_declaration).toBeNull();
  });

  it("mang cả video sang payload", () => {
    const v = mk({ videoUrls: ["https://example.test/a.mp4"] });
    expect(buildPostingPayload(v).video_urls).toEqual(["https://example.test/a.mp4"]);
  });
});

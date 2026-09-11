import { describe, expect, it } from "vitest";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { extractFromMedia, mediaSignature, type ExtractionInput } from "@/lib/aiMediaExtraction";
import { applyExtractedFields, wizardDefaults, type WizardValues } from "./wizardSchema";

const input = (over: Partial<ExtractionInput> = {}): ExtractionInput => ({
  parentSlug: "xe-co",
  childSlug: "o-to",
  province: "",
  imageUrls: ["https://x/a.jpg", "https://x/b.jpg"],
  videoUrls: [],
  ...over,
});

const values = (over: Partial<WizardValues> = {}): WizardValues => ({
  ...wizardDefaults,
  parentSlug: "xe-co",
  childSlug: "o-to",
  ...over,
});

const paths = (fields: { path: string }[]) => new Set(fields.map((f) => f.path));

describe("extractFromMedia", () => {
  it("tất định — cùng đầu vào ra cùng kết quả", () => {
    expect(extractFromMedia(input())).toEqual(extractFromMedia(input()));
  });

  it("đổi ảnh thì kết quả đổi", () => {
    const a = extractFromMedia(input());
    const b = extractFromMedia(input({ imageUrls: ["https://x/c.jpg"] }));
    expect(a.signature).not.toBe(b.signature);
  });

  it("confidence luôn trong [0,1]", () => {
    for (const cat of ["o-to", "dat-o", "sat-thep", "noi-that"]) {
      for (const f of extractFromMedia(input({ childSlug: cat })).fields) {
        expect(f.confidence).toBeGreaterThanOrEqual(0);
        expect(f.confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  it("nhiều ảnh và có video thì tin cậy cao hơn", () => {
    const low = extractFromMedia(input({ imageUrls: ["https://x/a.jpg"] }));
    const high = extractFromMedia(input({ imageUrls: ["https://x/a.jpg"], videoUrls: ["https://x/v.mp4"] }));
    const brand = (r: typeof low) => r.fields.find((f) => f.path === "delta.brand")!.confidence;
    expect(brand(high)).toBeGreaterThan(brand(low));
  });

  it("giá trị của trường select luôn là một option có thật", () => {
    for (const childSlug of Object.keys({ "o-to": 1, "dat-o": 1, "can-ho": 1, "xe-tai": 1, "sat-thep": 1 })) {
      const descriptors = getDeltaFields(childSlug);
      for (const f of extractFromMedia(input({ childSlug })).fields) {
        const d = descriptors.find((x) => `delta.${x.key}` === f.path);
        if (d?.type !== "select") continue;
        expect(d.options?.map((o) => o.value)).toContain(f.value);
        expect(d.options?.find((o) => o.value === f.value)?.label).toBe(f.display);
      }
    }
  });

  it("quận/phường đề xuất phải thuộc đúng tỉnh đang chọn", () => {
    const province = "TP. Hồ Chí Minh";
    const r = extractFromMedia(input({ province }));
    const prov = vietnamProvinces.find((p) => p.name === province)!;
    const district = r.fields.find((f) => f.path === "district")!.value;
    const ward = r.fields.find((f) => f.path === "ward")!.value;
    const d = prov.districts.find((x) => x.name === district);
    expect(d).toBeDefined();
    expect(d!.wards).toContain(ward);
  });

  it("không đề xuất đè tỉnh mà người dùng đã chọn", () => {
    expect(paths(extractFromMedia(input({ province: "Hà Nội" })).fields)).not.toContain("province");
    expect(paths(extractFromMedia(input()).fields)).toContain("province");
  });

  it("loại tài sản không có delta field → không trả trường nào", () => {
    expect(extractFromMedia(input({ parentSlug: "khac", childSlug: "khong-ton-tai" })).fields).toEqual([]);
  });

  it("signature gồm cả loại tài sản, không chỉ media", () => {
    const media = { imageUrls: ["https://x/a.jpg"], videoUrls: [] as string[] };
    expect(mediaSignature({ childSlug: "o-to", ...media })).not.toBe(
      mediaSignature({ childSlug: "xe-may", ...media }),
    );
  });
});

describe("applyExtractedFields", () => {
  const result = extractFromMedia(input());

  it("bỏ qua trường không được tick", () => {
    expect(applyExtractedFields(values(), result.fields, new Set())).toEqual({});
  });

  it("gộp delta vào một object, giữ nguyên key người dùng đã nhập", () => {
    const v = values({ deltaFields: { color: "Xanh", year: "2015" } });
    const patch = applyExtractedFields(v, result.fields, new Set(["delta.brand"]));
    expect(patch.deltaFields).toMatchObject({ color: "Xanh", year: "2015" });
    expect(patch.deltaFields!.brand).toBe(result.fields.find((f) => f.path === "delta.brand")!.value);
  });

  it("áp province thì district/ward đi kèm, không giữ lại của tỉnh cũ", () => {
    const v = values({ province: "", district: "Quận cũ", ward: "Phường cũ" });
    const province = result.fields.find((f) => f.path === "province")!;
    // Chỉ tick mỗi province — district/ward không tick nên phải bị xoá trắng.
    const patch = applyExtractedFields(v, result.fields, new Set(["province"]));
    expect(patch.province).toBe(province.value);
    expect(patch.district).toBe("");
    expect(patch.ward).toBe("");
  });

  it("tick cả province lẫn district/ward thì lấy giá trị AI đề xuất", () => {
    const v = values({ province: "" });
    const patch = applyExtractedFields(v, result.fields, new Set(["province", "district", "ward"]));
    expect(patch.district).toBe(result.fields.find((f) => f.path === "district")!.value);
    expect(patch.ward).toBe(result.fields.find((f) => f.path === "ward")!.value);
  });

  it("bỏ qua path lạ thay vì nhét bừa vào form", () => {
    const rogue = [{ ...result.fields[0], path: "startingPrice" }];
    expect(applyExtractedFields(values(), rogue, new Set(["startingPrice"]))).toEqual({});
  });
});

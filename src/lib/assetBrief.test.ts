import { describe, it, expect } from "vitest";
import { buildAssetBrief, priceInWords, type AssetBriefInput } from "./assetBrief";

const mk = (over: Partial<AssetBriefInput> = {}): AssetBriefInput => ({
  parentSlug: "bat-dong-san",
  childSlug: "nha-pho",
  title: "Nhà phố mặt tiền Nguyễn Thị Thập",
  description: null,
  province: "TP. Hồ Chí Minh",
  district: "Quận 7",
  deltaFields: {},
  pricingMode: "self",
  startingPrice: 8_500_000_000,
  format: "truc_tuyen",
  expectedTimeline: "normal",
  hasDispute: false,
  hasMortgage: false,
  isSeized: false,
  imageCount: 6,
  videoCount: 1,
  proofCount: 3,
  docCount: 0,
  ...over,
});

describe("priceInWords", () => {
  it("quy về tỷ / triệu / đồng", () => {
    expect(priceInWords(8_500_000_000)).toBe("8,5 tỷ đồng");
    expect(priceInWords(750_000_000)).toBe("750 triệu đồng");
    expect(priceInWords(90_000)).toBe("90.000 đồng");
  });
});

describe("buildAssetBrief — tài sản & vị trí", () => {
  it("mở đầu bằng loại tài sản, tên và nơi có tài sản", () => {
    const b = buildAssetBrief(mk({ title: "Lô đất góc hai mặt tiền", childSlug: "dat-o" }));
    expect(b.startsWith("Đất ở: Lô đất góc hai mặt tiền, tại Quận 7, TP. Hồ Chí Minh.")).toBe(true);
  });

  it("không lặp loại tài sản khi tên đã bắt đầu bằng chính nó", () => {
    const b = buildAssetBrief(mk());
    expect(b).not.toContain("Nhà phố: Nhà phố");
    expect(b.startsWith("Nhà phố mặt tiền Nguyễn Thị Thập, tại Quận 7")).toBe(true);
  });

  it("bỏ hẳn phần vị trí khi chưa khai tỉnh/quận", () => {
    const b = buildAssetBrief(mk({ province: null, district: null }));
    expect(b).not.toContain("tại ");
  });

  it("đưa mô tả của chủ tài sản vào nguyên văn", () => {
    const b = buildAssetBrief(mk({ description: "Nhà 3 tầng, đang cho thuê" }));
    expect(b).toContain("Nhà 3 tầng, đang cho thuê.");
  });

  it("dịch thông số phụ theo nhãn + đơn vị của descriptor", () => {
    const b = buildAssetBrief(mk({ deltaFields: { land_area: 90 } }));
    expect(b).toContain("Thông số chính: diện tích đất 90 m²");
  });

  it("dịch option select ra nhãn, không in slug thô", () => {
    const b = buildAssetBrief(mk({ deltaFields: { direction: "dong-nam" } }));
    expect(b).toContain("hướng nhà Đông Nam");
    expect(b).not.toContain("dong-nam");
  });

  it("giới hạn 4 thông số phụ để brief không thành bảng", () => {
    const b = buildAssetBrief(
      mk({
        deltaFields: {
          land_area: 90,
          floor_area: 250,
          floors: 3,
          bedrooms: 4,
          direction: "dong",
          legal_book: "so-hong",
        },
      }),
    );
    const specs = b.match(/Thông số chính: (.+?)\.$/m)?.[1] ?? "";
    expect(specs).not.toBe("");
    // 4 mệnh đề ⇒ tối đa 2 dấu phẩy rồi nối bằng "và".
    expect(specs.split(",").length).toBe(3);
  });

  it("bỏ qua thông số để trống, không để lại dấu phẩy lửng", () => {
    const b = buildAssetBrief(mk({ deltaFields: { land_area: 90, floors: "", direction: "" } }));
    expect(b).toContain("Thông số chính: diện tích đất 90 m².");
  });

  it("bỏ hẳn mục thông số khi không khai gì", () => {
    expect(buildAssetBrief(mk({ deltaFields: {} }))).not.toContain("Thông số chính");
  });

  it("bỏ qua key không có trong registry thay vì in key thô", () => {
    const b = buildAssetBrief(mk({ deltaFields: { key_la_khong_ton_tai: 42 } }));
    expect(b).not.toContain("Thông số chính");
    expect(b).not.toContain("42");
  });
});

describe("buildAssetBrief — kỳ vọng đấu giá", () => {
  it("nêu giá khởi điểm thành lời khi chủ tài sản tự định giá", () => {
    expect(buildAssetBrief(mk())).toContain("đề xuất giá khởi điểm 8,5 tỷ đồng");
  });

  it("nói rõ là nhờ định giá thay vì bịa ra một con số", () => {
    const b = buildAssetBrief(mk({ pricingMode: "appraisal", startingPrice: null }));
    expect(b).toContain("mong tổ chức định giá khởi điểm");
    expect(b).not.toContain("tỷ đồng");
  });

  it("nêu hình thức đấu giá và mốc thời gian kỳ vọng", () => {
    const b = buildAssetBrief(mk());
    expect(b).toContain("hình thức trực tuyến");
    expect(b).toContain("1–3 tháng");
  });

  it("bỏ mốc thời gian khi chưa chọn", () => {
    expect(buildAssetBrief(mk({ expectedTimeline: null }))).not.toContain("thời gian kỳ vọng");
  });

  it("bỏ qua mốc thời gian lạ thay vì in ra undefined", () => {
    const b = buildAssetBrief(mk({ expectedTimeline: "khong-ton-tai" }));
    expect(b).not.toContain("undefined");
    expect(b).not.toContain("thời gian kỳ vọng");
  });
});

describe("buildAssetBrief — tình trạng pháp lý", () => {
  it("nêu rõ khi tài sản đang thế chấp", () => {
    expect(buildAssetBrief(mk({ hasMortgage: true }))).toContain("Lưu ý pháp lý: tài sản đang thế chấp.");
  });

  it("gộp nhiều vướng mắc vào một câu", () => {
    const b = buildAssetBrief(mk({ hasDispute: true, hasMortgage: true, isSeized: true }));
    expect(b).toContain("đang có tranh chấp, đang thế chấp và đang bị kê biên");
  });

  it("không có mục pháp lý khi tài sản sạch", () => {
    expect(buildAssetBrief(mk())).not.toContain("Lưu ý pháp lý");
  });

  it("im lặng khi chưa khai báo, không suy ra là 'sạch'", () => {
    const b = buildAssetBrief(mk({ hasDispute: null, hasMortgage: null, isSeized: null }));
    expect(b).not.toContain("Lưu ý pháp lý");
  });
});

describe("buildAssetBrief — hồ sơ kèm theo", () => {
  it("liệt kê ảnh, video và giấy tờ đã có", () => {
    expect(buildAssetBrief(mk())).toContain("6 ảnh, 1 video và 3 giấy tờ sở hữu");
  });

  it("bỏ hẳn câu này khi chưa kèm gì", () => {
    const b = buildAssetBrief(mk({ imageCount: 0, videoCount: 0, proofCount: 0, docCount: 0 }));
    expect(b).not.toContain("Hồ sơ đã số hoá kèm");
  });
});

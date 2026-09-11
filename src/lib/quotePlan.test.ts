import { describe, expect, it } from "vitest";
import {
  depositAmount,
  depositOutOfLegalRange,
  depositPercent,
  emptyQuotePlan,
  feeTotal,
  feeTotalRequired,
  milestonesOutOfOrder,
  planLeadTimeDays,
  planSummary,
  validateQuote,
} from "./quotePlan";
import type { QuoteFeeItem, QuotePlan } from "@/types/consignment";

const fee = (label: string, amount: number, optional = false): QuoteFeeItem => ({
  key: "khac",
  label,
  amount,
  optional,
});

function plan(overrides: Partial<QuotePlan> = {}): QuotePlan {
  return { ...emptyQuotePlan("truc_tiep"), ...overrides };
}

describe("tổng chi phí", () => {
  const items = [fee("Phí hồ sơ", 2_000_000), fee("Phí niêm yết", 5_000_000), fee("Thẩm định", 8_000_000, true)];

  it("feeTotalRequired bỏ qua khoản tuỳ chọn", () => {
    expect(feeTotalRequired(items)).toBe(7_000_000);
  });

  it("feeTotal cộng cả khoản tuỳ chọn", () => {
    expect(feeTotal(items)).toBe(15_000_000);
  });

  it("danh sách rỗng hoặc null cho tổng 0", () => {
    expect(feeTotalRequired([])).toBe(0);
    expect(feeTotalRequired(null)).toBe(0);
    expect(feeTotal(undefined)).toBe(0);
  });

  it("khoản tuỳ chọn duy nhất không làm phồng phí dịch vụ", () => {
    expect(feeTotalRequired([fee("Vận chuyển", 30_000_000, true)])).toBe(0);
  });
});

describe("mốc thời gian", () => {
  it("planLeadTimeDays lấy mốc mở phiên", () => {
    expect(planLeadTimeDays(plan({ milestones: { tham_dinh: 7, mo_phien: 45 } }))).toBe(45);
    expect(planLeadTimeDays(plan({ milestones: { tham_dinh: 7 } }))).toBeNull();
    expect(planLeadTimeDays(null)).toBeNull();
  });

  it("phát hiện mốc không tăng dần", () => {
    expect(milestonesOutOfOrder(plan({ milestones: { tham_dinh: 7, niem_yet: 15, mo_phien: 30 } }))).toBe(false);
    expect(milestonesOutOfOrder(plan({ milestones: { tham_dinh: 20, niem_yet: 15 } }))).toBe(true);
  });

  it("bỏ trống mốc giữa vẫn hợp lệ nếu phần còn lại tăng dần", () => {
    expect(milestonesOutOfOrder(plan({ milestones: { tham_dinh: 7, mo_phien: 30 } }))).toBe(false);
  });
});

describe("tiền đặt trước", () => {
  const startingPrice = 10_000_000_000;

  it("quy đổi hai chế độ về VNĐ", () => {
    expect(depositAmount(plan({ deposit_mode: "percent", deposit_value: 10 }), startingPrice)).toBe(1_000_000_000);
    expect(depositAmount(plan({ deposit_mode: "amount", deposit_value: 500_000_000 }), startingPrice)).toBe(500_000_000);
  });

  it("chế độ số tiền không cần giá khởi điểm", () => {
    expect(depositAmount(plan({ deposit_mode: "amount", deposit_value: 500_000_000 }), null)).toBe(500_000_000);
    expect(depositAmount(plan({ deposit_mode: "percent", deposit_value: 10 }), null)).toBeNull();
  });

  it("suy ra % từ số tiền để đối chiếu khung luật", () => {
    expect(depositPercent(plan({ deposit_mode: "amount", deposit_value: 500_000_000 }), startingPrice)).toBe(5);
  });

  it("cảnh báo khi ngoài khung 5–20%", () => {
    expect(depositOutOfLegalRange(plan({ deposit_mode: "percent", deposit_value: 10 }), startingPrice)).toBe(false);
    expect(depositOutOfLegalRange(plan({ deposit_mode: "percent", deposit_value: 5 }), startingPrice)).toBe(false);
    expect(depositOutOfLegalRange(plan({ deposit_mode: "percent", deposit_value: 25 }), startingPrice)).toBe(true);
    expect(depositOutOfLegalRange(plan({ deposit_mode: "percent", deposit_value: 3 }), startingPrice)).toBe(true);
    expect(depositOutOfLegalRange(plan({ deposit_mode: "amount", deposit_value: 3_000_000_000 }), startingPrice)).toBe(true);
  });

  it("không cảnh báo khi chưa nhập", () => {
    expect(depositOutOfLegalRange(plan(), startingPrice)).toBe(false);
  });
});

describe("planSummary", () => {
  it("không có phương án thì không có dòng nào", () => {
    expect(planSummary(null)).toEqual([]);
  });

  it("dựng dòng theo đúng thứ tự và bỏ ô trống", () => {
    const rows = planSummary(
      plan({
        price_step: 50_000_000,
        deposit_mode: "percent",
        deposit_value: 10,
        channels: ["cong_tsdg", "bao_in"],
        channels_other: "Đài truyền hình tỉnh",
        milestones: { tham_dinh: 7, mo_phien: 30 },
        scope_included: ["ho_so"],
      }),
      10_000_000_000,
    );
    const labels = rows.map((r) => r.label);

    expect(labels).toEqual([
      "Hình thức đề xuất",
      "Bước giá",
      "Tiền đặt trước",
      "Kênh niêm yết",
      "Thẩm định & định giá",
      "Mở phiên",
      "Bao gồm",
    ]);
    expect(rows.find((r) => r.label === "Kênh niêm yết")?.value).toBe(
      "Cổng Đấu giá tài sản quốc gia · Báo in · Đài truyền hình tỉnh",
    );
    // Tiền đặt trước hiện cả % lẫn số tiền quy đổi để so sánh được.
    expect(rows.find((r) => r.label === "Tiền đặt trước")?.value).toContain("10%");
    expect(rows.find((r) => r.label === "Mở phiên")?.value).toBe("30 ngày");
  });
});

describe("validateQuote", () => {
  const ok = plan({ milestones: { mo_phien: 30 } });

  it("chấp nhận báo giá đủ tối thiểu", () => {
    expect(validateQuote(ok, [fee("Phí hồ sơ", 1_000_000)], 1.5).ok).toBe(true);
  });

  it("bắt buộc hình thức và mốc mở phiên", () => {
    const r = validateQuote(plan({ auction_format: null }), [fee("Phí hồ sơ", 1)], 1);
    expect(r.ok).toBe(false);
    expect(r.errors.plan).toContain("Chọn hình thức đấu giá đề xuất");
    expect(r.errors.plan).toContain("Nhập số ngày tới khi mở phiên");
  });

  it("chặn thù lao ngoài 0–100%", () => {
    expect(validateQuote(ok, [], 120).errors.fee).toContain("Thù lao phải trong khoảng 0–100%");
  });

  it("phải có thù lao hoặc ít nhất một khoản chi phí", () => {
    expect(validateQuote(ok, [], null).ok).toBe(false);
    expect(validateQuote(ok, [], 0).ok).toBe(true);
  });

  it("gom lỗi theo tab và không lặp", () => {
    const r = validateQuote(ok, [fee("", 1), fee("", 2)], null);
    expect(r.errors.fee.filter((e) => e === "Mỗi khoản chi phí phải có tên")).toHaveLength(1);
    expect(r.errors.plan).toHaveLength(0);
  });
});

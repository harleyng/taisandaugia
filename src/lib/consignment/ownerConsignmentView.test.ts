import { describe, expect, it } from "vitest";
import {
  bestOf,
  depositLabel,
  estimatedCost,
  kgActivityLog,
  kgNextLine,
  kgStageOf,
  kgStatusOf,
  kgWhoLabel,
  orgInitials,
  orgShortName,
  type KgLogRequest,
} from "./ownerConsignmentView";
import type { QuotePlan } from "@/types/asset-posting";

const facts = { waitingCount: 3, sentCount: 3, declinedCount: 0, quotedCount: 2, orgName: "Công ty ĐGHD Lạc Việt" };

describe("kgStageOf", () => {
  it("gộp hợp đồng vào Đã chọn tổ chức", () => {
    expect(kgStageOf("da_chon", false)).toBe("da_chon");
    expect(kgStageOf("hop_dong", false)).toBe("da_chon");
    expect(kgStageOf("da_ky", false)).toBe("da_chon");
  });

  it("tách nhờ sàn khỏi chờ báo giá", () => {
    expect(kgStageOf("cho_bao_gia", true)).toBe("nho_san");
    expect(kgStageOf("cho_bao_gia", false)).toBe("cho_bao_gia");
    // Đã có báo giá thì chủ tài sản chọn, dù sàn đang lo.
    expect(kgStageOf("cho_chon", true)).toBe("cho_chon");
  });
});

describe("kgStatusOf", () => {
  it("việc của bạn theo owner_action, không theo giai đoạn", () => {
    const mine = kgStatusOf("cho_chon", "choose_quote");
    expect(mine.mine).toBe(true);
    expect(kgWhoLabel(mine)).toBe("Việc của bạn");

    // Người chỉ có quyền xem: cùng giai đoạn nhưng không có việc.
    const viewer = kgStatusOf("cho_chon", null);
    expect(viewer.mine).toBe(false);
    expect(kgWhoLabel(viewer)).toBe("Chờ chủ tài sản");
  });

  it("tone theo thiết kế", () => {
    expect(kgStatusOf("het_to_chuc", "add_orgs").tone).toBe("err");
    expect(kgStatusOf("cho_bao_gia", null).tone).toBe("wait");
    expect(kgStatusOf("nho_san", null).tone).toBe("wait");
    expect(kgStatusOf("da_chon", null).tone).toBe("ok");
    // Còn việc hợp đồng: vẫn lượt chủ tài sản.
    const contract = kgStatusOf("da_chon", "confirm_contract");
    expect(contract.tone).toBe("me");
    expect(contract.who).toBe("owner");
    expect(contract.step).toBe(3);
  });
});

describe("kgNextLine", () => {
  it("câu bước tiếp theo", () => {
    expect(kgNextLine(kgStatusOf("cho_bao_gia", null), facts)).toBe("Đang chờ 3 tổ chức báo giá");
    expect(kgNextLine(kgStatusOf("cho_chon", "choose_quote"), facts)).toBe("So sánh và chọn 1 trong 2 báo giá");
    expect(kgNextLine(kgStatusOf("het_to_chuc", "add_orgs"), { ...facts, sentCount: 2, declinedCount: 2 })).toBe(
      "Cả 2 tổ chức đều từ chối",
    );
    expect(kgNextLine(kgStatusOf("da_chon", null), facts)).toBe("Đã chọn Công ty ĐGHD Lạc Việt");
    expect(kgNextLine(kgStatusOf("da_chon", "confirm_contract"), facts)).toBe(
      "Xác nhận hợp đồng với Công ty ĐGHD Lạc Việt",
    );
  });
});

describe("orgShortName / orgInitials", () => {
  it("bỏ tiền tố loại hình ở đầu tên", () => {
    expect(orgShortName("Công ty ĐGHD Lạc Việt")).toBe("Lạc Việt");
    expect(orgShortName("Công ty Đấu giá hợp danh Miền Nam")).toBe("Miền Nam");
    expect(orgShortName("Trung tâm Dịch vụ đấu giá tài sản tỉnh Bình Dương")).toBe("Bình Dương");
    expect(orgShortName("Đấu giá")).toBe("Đấu giá");
  });

  it("chữ viết tắt giữ Đ, bỏ dấu", () => {
    expect(orgInitials("Công ty ĐGHD Lạc Việt")).toBe("LV");
    expect(orgInitials("Công ty Đấu giá Đông Á")).toBe("ĐA");
    expect(orgInitials("Công ty TNHH Thăng Long")).toBe("TL");
    expect(orgInitials("Vạn Xuân")).toBe("VX");
    expect(orgInitials("Sotheby")).toBe("SO");
  });
});

describe("báo giá", () => {
  it("tổng chi phí ước tính = thù lao × giá khởi điểm + phí", () => {
    expect(estimatedCost(1.2, 15_000_000, 4_300_000_000)).toBe(66_600_000);
    expect(estimatedCost(null, 15_000_000, 4_300_000_000)).toBeNull();
  });

  it("tốt nhất chỉ khi có ít nhất hai số khác nhau", () => {
    expect(bestOf([1.2, 1.6], "min")).toBe(1.2);
    expect(bestOf([4300, 4100], "max")).toBe(4300);
    expect(bestOf([1.2], "min")).toBeNull();
    expect(bestOf([1.2, null], "min")).toBeNull();
    expect(bestOf([2, 2], "min")).toBeNull();
  });

  it("tiền đặt trước theo % hoặc số tiền", () => {
    const plan = (mode: "percent" | "amount", v: number | null) => ({ deposit_mode: mode, deposit_value: v }) as QuotePlan;
    expect(depositLabel(plan("percent", 10))).toBe("10%");
    expect(depositLabel(plan("amount", 50_000_000))).toBe("50 tr");
    expect(depositLabel(plan("percent", null))).toBeNull();
    expect(depositLabel(null)).toBeNull();
  });
});

describe("kgActivityLog", () => {
  const req = (over: Partial<KgLogRequest>): KgLogRequest => ({
    orgName: "Công ty Đấu giá Miền Nam",
    status: "sent",
    origin: "owner",
    created_at: "2026-09-20T02:00:00Z",
    seen_at: null,
    quoted_at: null,
    updated_at: "2026-09-20T02:00:00Z",
    reopened_at: null,
    ...over,
  });

  it("gộp lượt gửi cùng ngày, mới nhất trước", () => {
    const log = kgActivityLog({
      submittedAt: "2026-09-18T01:00:00Z",
      approvedAt: "2026-09-19T01:00:00Z",
      broker: null,
      contracts: [],
      requests: [
        req({ status: "quoted", quoted_at: "2026-09-24T03:00:00Z", seen_at: "2026-09-21T03:00:00Z" }),
        req({ orgName: "Công ty Đấu giá Đông Á", status: "declined", updated_at: "2026-09-22T03:00:00Z" }),
      ],
    });
    expect(log.map((e) => e.text)).toEqual([
      "Miền Nam gửi báo giá",
      "Đông Á từ chối nhận hồ sơ",
      "Miền Nam đã xem hồ sơ",
      "Bạn gửi hồ sơ cho 2 tổ chức",
      "Sàn duyệt hồ sơ số hoá",
      "Bạn gửi hồ sơ để sàn duyệt",
    ]);
  });

  it("chọn tổ chức nói số yêu cầu khác đã đóng", () => {
    const log = kgActivityLog({
      submittedAt: null,
      approvedAt: null,
      broker: { status: "selected", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-25T00:00:00Z" },
      contracts: [],
      requests: [
        req({ origin: "platform", status: "selected", updated_at: "2026-09-25T00:00:00Z" }),
        req({ origin: "platform", orgName: "Công ty Đấu giá Đông Á", status: "not_selected" }),
      ],
    });
    expect(log[0].text).toBe("Bạn chọn Miền Nam · 1 yêu cầu khác đóng lại");
    expect(log.some((e) => e.text === "Sàn gửi hồ sơ cho 2 tổ chức")).toBe(true);
    expect(log.at(-1)?.text).toBe("Bạn nhờ sàn chọn tổ chức giúp");
  });
});

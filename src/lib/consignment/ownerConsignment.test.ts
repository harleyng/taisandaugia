import { describe, expect, it } from "vitest";
import {
  consignmentStageOf,
  matchesConsignmentFilter,
  ownerConsignmentPath,
  type ConsignmentFacts,
} from "./ownerConsignment";

const facts = (over: Partial<ConsignmentFacts> = {}): ConsignmentFacts => ({
  postingStatus: "active",
  reviewStatus: "approved",
  requestStatuses: [],
  brokerStatus: null,
  contractStatuses: [],
  ...over,
});

describe("consignmentStageOf", () => {
  it("nháp, đã huỷ, chưa duyệt mà chưa gửi ⇒ chưa thuộc menu Ký gửi", () => {
    expect(consignmentStageOf(facts({ postingStatus: "draft" }))).toBeNull();
    expect(consignmentStageOf(facts({ postingStatus: "cancelled", requestStatuses: ["quoted"] }))).toBeNull();
    expect(consignmentStageOf(facts({ reviewStatus: "pending" }))).toBeNull();
    expect(consignmentStageOf(facts({ reviewStatus: "rejected" }))).toBeNull();
  });

  it("đã duyệt, chưa gửi ai ⇒ Chưa gửi", () => {
    expect(consignmentStageOf(facts())).toBe("chua_gui");
    // Nhờ sàn rồi huỷ thì như chưa gửi.
    expect(consignmentStageOf(facts({ brokerStatus: "cancelled" }))).toBe("chua_gui");
  });

  it("đang chờ tổ chức hoặc sàn ⇒ Chờ báo giá", () => {
    expect(consignmentStageOf(facts({ requestStatuses: ["sent", "declined"] }))).toBe("cho_bao_gia");
    expect(consignmentStageOf(facts({ requestStatuses: ["seen"] }))).toBe("cho_bao_gia");
    expect(consignmentStageOf(facts({ brokerStatus: "pending" }))).toBe("cho_bao_gia");
    expect(consignmentStageOf(facts({ brokerStatus: "sourcing", requestStatuses: ["sent"] }))).toBe("cho_bao_gia");
  });

  it("có báo giá chưa chốt ⇒ Chờ chọn, kể cả khi hồ sơ bị sửa và về chờ duyệt", () => {
    expect(consignmentStageOf(facts({ requestStatuses: ["quoted", "sent"] }))).toBe("cho_chon");
    expect(consignmentStageOf(facts({ reviewStatus: "pending", requestStatuses: ["quoted"] }))).toBe("cho_chon");
  });

  it("mọi tổ chức đều không nhận ⇒ Cần gửi thêm", () => {
    expect(consignmentStageOf(facts({ requestStatuses: ["declined", "withdrawn"] }))).toBe("het_to_chuc");
    expect(consignmentStageOf(facts({ requestStatuses: ["contract_cancelled", "declined"] }))).toBe("het_to_chuc");
  });

  it("hợp đồng quyết định trước yêu cầu", () => {
    expect(
      consignmentStageOf(facts({ requestStatuses: ["selected", "not_selected"], contractStatuses: ["drafting"] })),
    ).toBe("hop_dong");
    expect(consignmentStageOf(facts({ requestStatuses: ["selected"], contractStatuses: ["signed"] }))).toBe("da_ky");
  });

  it("hợp đồng huỷ ⇒ báo giá cũ mở lại, về Chờ chọn", () => {
    expect(
      consignmentStageOf(
        facts({ requestStatuses: ["contract_cancelled", "quoted"], contractStatuses: ["cancelled"] }),
      ),
    ).toBe("cho_chon");
  });

  it("đã chốt mà không có hợp đồng trên sàn (dữ liệu cũ) ⇒ Đã chọn tổ chức", () => {
    expect(consignmentStageOf(facts({ requestStatuses: ["selected"] }))).toBe("da_chon");
    expect(consignmentStageOf(facts({ requestStatuses: ["accepted"] }))).toBe("da_chon");
    expect(consignmentStageOf(facts({ postingStatus: "matched" }))).toBe("da_chon");
    expect(consignmentStageOf(facts({ postingStatus: "contracted" }))).toBe("da_ky");
  });
});

describe("matchesConsignmentFilter", () => {
  it("Cần bạn xử lý chỉ theo owner_action, không theo giai đoạn", () => {
    expect(matchesConsignmentFilter("can-xu-ly", { stage: "cho_chon", needsAction: true })).toBe(true);
    expect(matchesConsignmentFilter("can-xu-ly", { stage: "het_to_chuc", needsAction: false })).toBe(false);
  });

  it("mỗi giai đoạn thuộc đúng một nhóm", () => {
    const row = (stage: Parameters<typeof matchesConsignmentFilter>[1]["stage"]) => ({ stage, needsAction: false });
    expect(matchesConsignmentFilter("cho-bao-gia", row("cho_bao_gia"))).toBe(true);
    // Cần gửi thêm / chờ chọn báo giá chỉ ở Tất cả + Cần bạn xử lý.
    expect(matchesConsignmentFilter("cho-bao-gia", row("het_to_chuc"))).toBe(false);
    expect(matchesConsignmentFilter("cho-bao-gia", row("cho_chon"))).toBe(false);
    expect(matchesConsignmentFilter("da-chon", row("da_chon"))).toBe(true);
    expect(matchesConsignmentFilter("da-chon", row("hop_dong"))).toBe(true);
    expect(matchesConsignmentFilter("da-chon", row("da_ky"))).toBe(true);
    expect(matchesConsignmentFilter("tat-ca", row("chua_gui"))).toBe(true);
  });
});

it("chi tiết ký gửi khoá theo id hồ sơ", () => {
  expect(ownerConsignmentPath("p1")).toBe("/chu-tai-san/ky-gui-dau-gia/p1");
});

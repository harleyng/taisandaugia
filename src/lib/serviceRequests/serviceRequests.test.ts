import { describe, expect, it } from "vitest";
import { SERVICE_GROUPS, SERVICE_STATUS_TONE, serviceGroupOf } from "./groups";
import { fromAuthentication, fromVrTour, matchesServiceSearch } from "./normalize";
import { serviceRequestListPath } from "./kinds";
import { VR_STATUS_LABELS } from "@/lib/vrTour/status";
import { GD_STATUS_LABELS } from "@/lib/authentication/status";
import { TVPL_STATUS_LABELS } from "@/lib/legalConsult/status";
import { TVDG_STATUS_LABELS } from "@/lib/auctionConsult/status";
import type { AdminAuthenticationOrder } from "@/hooks/useAdminAuthenticationOrders";
import type { AdminVrTourOrder } from "@/hooks/useAdminVrTourOrders";

const ALL_STATUSES = [
  ...Object.keys(VR_STATUS_LABELS),
  ...Object.keys(GD_STATUS_LABELS),
  ...Object.keys(TVPL_STATUS_LABELS),
  ...Object.keys(TVDG_STATUS_LABELS),
];

const NOW = new Date("2026-09-14T10:00:00Z").getTime();

describe("nhóm trạng thái chung", () => {
  it("mọi trạng thái của 4 loại dịch vụ thuộc đúng một nhóm và có màu badge", () => {
    for (const s of ALL_STATUSES) {
      expect(SERVICE_GROUPS.filter((g) => g.statuses.includes(s)), s).toHaveLength(1);
      expect(SERVICE_STATUS_TONE[s], s).toBeTruthy();
    }
  });

  it("VR đã giao vẫn là việc đang làm (chờ duyệt & gắn lô)", () => {
    expect(serviceGroupOf("delivered")).toBe("dang-thuc-hien");
    expect(serviceGroupOf("superseded")).toBe("hoan-tat");
  });
});

describe("chuẩn hoá dòng", () => {
  const vr = (extra: Partial<AdminVrTourOrder>) =>
    ({
      id: "v1",
      code: "VR000001",
      posting_title: "Căn hộ A",
      package_name: "Gói tiêu chuẩn",
      partner_name: "Silver Sea",
      quoted_price: null,
      quote_expires_at: null,
      appointment_at: null,
      status: "requested",
      created_at: "2026-09-01T00:00:00Z",
      asset_postings: null,
      ...extra,
    }) as unknown as AdminVrTourOrder;

  it("báo giá quá hạn hiệu lực ⇒ cảnh báo", () => {
    expect(fromVrTour(vr({ status: "quoted", quote_expires_at: "2026-09-13T00:00:00Z" }), NOW).alert).toBe(
      "Báo giá đã hết hạn",
    );
    expect(fromVrTour(vr({ status: "paid", quote_expires_at: "2026-09-13T00:00:00Z" }), NOW).alert).toBeNull();
  });

  it("lịch chụp VR đã qua mà chưa giao ⇒ cảnh báo quá lịch", () => {
    expect(fromVrTour(vr({ status: "scheduled", appointment_at: "2026-09-10T00:00:00Z" }), NOW).alert).toBe(
      "Đã qua lịch hẹn",
    );
  });

  it("giám định chỉ cảnh báo quá lịch với phương thức tại chỗ", () => {
    const gd = (method: string) =>
      ({
        id: "g1",
        code: "GD000001",
        posting_title: "Đồng hồ",
        partner_name: "ABC",
        method,
        status: "item_pending",
        appointment_at: "2026-09-10T00:00:00Z",
        quote_expires_at: null,
        quoted_price: 2_000_000,
        verdict: null,
        shipment_tracking: null,
        created_at: "2026-09-01T00:00:00Z",
      }) as unknown as AdminAuthenticationOrder;
    expect(fromAuthentication(gd("on_site"), NOW).alert).toBe("Đã qua lịch hẹn");
    expect(fromAuthentication(gd("ship_item"), NOW).alert).toBeNull();
  });

  it("tìm theo mã, tài sản, đối tác không phân biệt hoa thường", () => {
    const row = fromVrTour(vr({}), NOW);
    expect(matchesServiceSearch(row, "silver")).toBe(true);
    expect(matchesServiceSearch(row, "vr000001")).toBe(true);
    expect(matchesServiceSearch(row, "không có")).toBe(false);
  });
});

describe("đường dẫn quay lại danh sách", () => {
  it("giữ bộ lọc đang xem, không có thì mở tab của loại", () => {
    expect(serviceRequestListPath("giam-dinh", "?nhom=cho-bao-gia")).toBe("/admin/yeu-cau-dich-vu?nhom=cho-bao-gia");
    expect(serviceRequestListPath("giam-dinh")).toBe("/admin/yeu-cau-dich-vu?loai=giam-dinh");
  });
});

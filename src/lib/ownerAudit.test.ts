import { describe, expect, it } from "vitest";
import {
  auditChangeRows,
  auditChangedFields,
  auditDeviceLabel,
  auditEntityHref,
  auditFiltersToRpc,
  auditSessionRows,
  auditSummary,
  auditTargetFromPath,
  DEFAULT_AUDIT_FILTERS,
  formatAuditDuration,
  formatAuditValue,
  parseAuditPage,
  type AuditEntry,
} from "./ownerAudit";

const ID = "5eed0005-0000-4000-8000-000000000001";

function entry(p: Partial<AuditEntry>): AuditEntry {
  return {
    id: 1,
    created_at: "2026-10-01T03:00:00Z",
    last_at: "2026-10-01T03:00:00Z",
    actor: null,
    actor_kind: "member",
    actor_label: "Nguyễn Văn A",
    module: "so-hoa",
    action: "update",
    entity_type: "asset_postings",
    entity_id: ID,
    entity_label: "HS-0019 · Nhà phố",
    branch_id: null,
    branch_name: null,
    changes: {},
    meta: {},
    path: null,
    ...p,
  };
}

describe("formatAuditValue", () => {
  it("tiền nhóm nghìn bằng dấu phẩy, kể cả khi DB trả chuỗi", () => {
    expect(formatAuditValue("starting_price", 5000000)).toBe("5,000,000 ₫");
    expect(formatAuditValue("amount", "1250000")).toBe("1,250,000 ₫");
  });

  it("trống / boolean / trạng thái / ngày", () => {
    expect(formatAuditValue("title", null)).toBe("—");
    expect(formatAuditValue("has_dispute", true)).toBe("Có");
    expect(formatAuditValue("status", "finalized")).toBe("Đã chốt");
    expect(formatAuditValue("status", "ma_la")).toBe("ma_la");
    expect(formatAuditValue("period_start", "2026-09-01")).toBe("01/09/2026");
  });

  it("mảng tệp đếm số tệp; mảng chữ nối lại; quyền đổi ra nhãn", () => {
    expect(formatAuditValue("image_urls", ["org/a/1.jpg", "org/a/2.png"])).toBe("2 tệp");
    expect(formatAuditValue("abbreviations", ["BIDV", "BIDV CG"])).toBe("BIDV, BIDV CG");
    expect(formatAuditValue("permissions_added", ["so-hoa:update"])).toBe("Số hoá tài sản · Sửa & dịch vụ");
    expect(formatAuditValue("branch_scope", ["Cầu Giấy"])).toBe("Cầu Giấy");
  });
});

describe("auditSummary", () => {
  it("chỉ đổi trạng thái ⇒ câu đổi trạng thái", () => {
    const e = entry({ entity_type: "owner_report_snapshots", changes: { status: ["draft", "finalized"] } });
    expect(auditSummary(e)).toBe("Đổi trạng thái báo cáo định kỳ → Đã chốt");
  });

  it("sửa nhiều trường ⇒ Sửa + danh sách trường gọn", () => {
    const e = entry({ changes: { title: ["a", "b"], description: ["x", "y"], province: [null, "HN"], ward: [null, "1"] } });
    expect(auditSummary(e)).toBe("Sửa hồ sơ số hoá");
    expect(auditChangedFields(e)).toBe("Tiêu đề, Mô tả, Tỉnh / thành +1");
  });

  it("đổi quyền vai trò, khớp hàng loạt, lượt xem", () => {
    expect(
      auditSummary(entry({ entity_type: "owner_ws_roles", changes: { permissions_added: [null, ["ket-qua:update"]] } })),
    ).toBe("Đổi quyền vai trò");
    expect(auditSummary(entry({ action: "create", entity_type: "asset_owner_claims", entity_id: null }))).toBe(
      "Sàn khớp tài sản về đơn vị",
    );
    expect(auditSummary(entry({ action: "view", path: "/chu-tai-san/thu-tien", meta: {} }))).toBe("Xem trang Thu tiền");
    expect(auditSummary(entry({ action: "export", meta: { title: "Dòng tiền" } }))).toBe("Xuất Excel Dòng tiền");
  });
});

describe("auditChangeRows", () => {
  it("tạo mới: trước là —", () => {
    const rows = auditChangeRows(entry({ action: "create", changes: { amount: [null, 2000000] } }));
    expect(rows).toEqual([{ key: "amount", label: "Số tiền", before: "—", after: "2,000,000 ₫" }]);
  });
});

describe("auditEntityHref", () => {
  it("bản ghi có trang riêng; mục con của hồ sơ mở hồ sơ; dòng xoá không có link", () => {
    expect(auditEntityHref(entry({}))).toBe(`/chu-tai-san/dang-tai-san/${ID}`);
    expect(
      auditEntityHref(entry({ entity_type: "asset_vr_tour_orders", entity_id: "x", meta: { posting_id: ID } })),
    ).toBe(`/chu-tai-san/dang-tai-san/${ID}`);
    expect(auditEntityHref(entry({ action: "delete" }))).toBeNull();
    expect(auditEntityHref(entry({ action: "view", path: "/chu-tai-san/ket-qua" }))).toBe("/chu-tai-san/ket-qua");
  });
});

describe("auditTargetFromPath", () => {
  it("trang danh sách ⇒ module, không có bản ghi", () => {
    expect(auditTargetFromPath("/chu-tai-san/thu-tien")).toEqual({
      module: "thu-tien",
      entityType: null,
      entityId: null,
      title: "Thu tiền",
    });
  });

  it("trang chi tiết ⇒ loại bản ghi + id", () => {
    expect(auditTargetFromPath(`/chu-tai-san/dang-tai-san/${ID}`)).toMatchObject({
      module: "so-hoa",
      entityType: "asset_postings",
      entityId: ID,
    });
    expect(auditTargetFromPath(`/chu-tai-san/hop-dong/mua-ban/${ID}`)).toMatchObject({
      module: "hop-dong-mua-ban",
      entityType: "auction_sale_contracts",
      entityId: ID,
    });
  });

  it("route không phải id (chi-tieu/moi) không thành bản ghi; ngoài cổng ⇒ null", () => {
    expect(auditTargetFromPath("/chu-tai-san/chi-tieu/moi")).toMatchObject({ module: "chi-tieu", entityId: null });
    expect(auditTargetFromPath("/listings")).toBeNull();
  });
});

describe("auditFiltersToRpc", () => {
  const now = new Date("2026-10-01T00:00:00Z");

  it("mặc định chỉ có mốc 30 ngày", () => {
    expect(auditFiltersToRpc(DEFAULT_AUDIT_FILTERS, now)).toEqual({ from: "2026-09-01T00:00:00.000Z" });
  });

  it("người làm theo vai (kind:) tách khỏi người cụ thể", () => {
    const f = { ...DEFAULT_AUDIT_FILTERS, q: "  hs-0019 ", actor: "kind:platform", module: "so-hoa", period: "all" as const };
    expect(auditFiltersToRpc(f, now)).toEqual({ q: "hs-0019", actor_kind: "platform", modules: ["so-hoa"] });
  });
});

describe("parseAuditPage", () => {
  it("chịu được dữ liệu thiếu", () => {
    expect(parseAuditPage(null)).toEqual({ level: "mine", total: 0, totalCapped: false, rows: [] });
  });
});

describe("đăng nhập / đăng xuất", () => {
  const MAC_CHROME =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
  const session = (p: Partial<AuditEntry>) =>
    entry({ module: null, entity_type: "auth_sessions", entity_label: null, action: "login", ...p });

  it("tóm tắt theo nguồn: trigger auth là đăng nhập thật, dòng cũ là truy cập cổng", () => {
    expect(auditSummary(session({ meta: { source: "auth" } }))).toBe("Đăng nhập");
    expect(auditSummary(session({ entity_type: null, meta: {}, path: "/chu-tai-san/dashboard" }))).toBe(
      "Truy cập Trạm Điều Hành",
    );
    expect(auditSummary(session({ action: "logout", meta: { source: "auth", reason: "signout" } }))).toBe("Đăng xuất");
    expect(auditSummary(session({ action: "logout", meta: { source: "auth", reason: "expired" } }))).toBe(
      "Phiên đăng nhập hết hạn",
    );
  });

  it("nhận ra trình duyệt + hệ điều hành", () => {
    expect(auditDeviceLabel(MAC_CHROME)).toBe("Chrome · macOS");
    expect(auditDeviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari · iOS");
    expect(auditDeviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0 Safari/537.36 Edg/129.0")).toBe("Edge · Windows");
    expect(auditDeviceLabel("curl/8.0")).toBe("Thiết bị khác");
    expect(auditDeviceLabel(null)).toBe("");
  });

  it("thời lượng phiên", () => {
    expect(formatAuditDuration(30)).toBe("dưới 1 phút");
    expect(formatAuditDuration(7_260)).toBe("2 giờ 1 phút");
    expect(formatAuditDuration(3 * 86_400 + 3_600)).toBe("3 ngày 1 giờ");
  });

  it("chi tiết phiên: thiết bị, IP, thời lượng chỉ khi đăng xuất", () => {
    const meta = { source: "auth", ip: "113.161.1.2", user_agent: MAC_CHROME, duration_seconds: 5_400 };
    expect(auditSessionRows(session({ meta }))).toEqual([
      { label: "Thiết bị", value: "Chrome · macOS" },
      { label: "Địa chỉ IP", value: "113.161.1.2" },
    ]);
    expect(auditSessionRows(session({ action: "logout", meta }))).toContainEqual({
      label: "Thời lượng phiên",
      value: "1 giờ 30 phút",
    });
    expect(auditSessionRows(entry({ action: "view", meta: { ip: "1.1.1.1" } }))).toEqual([]);
  });

  it("bộ lọc nhóm 'sessions' gửi thẳng lên server", () => {
    expect(auditFiltersToRpc({ ...DEFAULT_AUDIT_FILTERS, kind: "sessions", period: "all" })).toEqual({ kind: "sessions" });
  });
});

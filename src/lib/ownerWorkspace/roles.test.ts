import { describe, expect, it } from "vitest";
import {
  canWriteClaim,
  canWritePosting,
  ownerAccessCtx,
  ownerBranchOk,
  ownerCan,
  ownerCanIn,
  ownerIsScoped,
  ownerPortalName,
  ownerWsAccessLabel,
  roleWithinCaller,
  type OwnerWsAccessCtx,
  type PostingOwnership,
} from "./roles";
import { STAFF_DEFAULT_MATRIX, VIEWER_DEFAULT_MATRIX, type OwnerPermissionMatrix } from "./permissions";

// Bản sao owner_ws_has / owner_ws_branch_ok / owner_posting_row_can (migration 20260927170100).
const owner = ownerAccessCtx({ isOwner: true, matrix: {}, branchScope: null });
const staff = ownerAccessCtx({ isOwner: false, matrix: STAFF_DEFAULT_MATRIX, branchScope: null });
const viewer = ownerAccessCtx({ isOwner: false, matrix: VIEWER_DEFAULT_MATRIX, branchScope: null });
const scoped = (matrix: OwnerPermissionMatrix, branches: string[]): OwnerWsAccessCtx =>
  ownerAccessCtx({ isOwner: false, matrix, branchScope: branches });
const hq = ownerAccessCtx({ isOwner: false, matrix: {}, branchScope: null, accessVia: "hq" });

describe("ownerCan", () => {
  it("Trưởng đơn vị có mọi quyền, kể cả quyền vai trò khác không có", () => {
    expect(ownerCan(owner, "vai-tro", "delete")).toBe(true);
    expect(ownerCan(owner, "bao-cao-dinh-ky", "finalize")).toBe(true);
  });

  it("vai trò thường chỉ có đúng quyền trong ma trận", () => {
    expect(ownerCan(staff, "ket-qua", "update")).toBe(true);
    expect(ownerCan(staff, "bao-cao-dinh-ky", "finalize")).toBe(false);
    expect(ownerCan(staff, "thanh-vien", "create")).toBe(false);
    expect(ownerCan(viewer, "ket-qua", "view")).toBe(true);
    expect(ownerCan(viewer, "ket-qua", "update")).toBe(false);
  });

  it("không phải thành viên ⇒ không có gì", () => {
    expect(ownerCan(null, "ket-qua", "view")).toBe(false);
    expect(ownerCan(undefined, "tai-san", "view")).toBe(false);
  });

  it("trụ sở đã liên kết: chỉ xem, không thấy thành viên / vai trò / liên kết của chi nhánh", () => {
    expect(ownerCan(hq, "ket-qua", "view")).toBe(true);
    expect(ownerCan(hq, "ket-qua", "update")).toBe(false);
    expect(ownerCan(hq, "thanh-vien", "view")).toBe(false);
    expect(ownerCan(hq, "vai-tro", "view")).toBe(false);
  });
});

describe("phạm vi chi nhánh", () => {
  const BR1 = "branch-1";
  const BR2 = "branch-2";

  it("Trưởng đơn vị không bao giờ bị giới hạn, kể cả khi dữ liệu có phạm vi", () => {
    const o = ownerAccessCtx({ isOwner: true, matrix: {}, branchScope: [BR1] });
    expect(o.branchScope).toBeNull();
    expect(ownerBranchOk(o, BR2)).toBe(true);
    expect(ownerIsScoped(o)).toBe(false);
  });

  it("vai trò bất kỳ (không chỉ Cán bộ) bị giới hạn chỉ ghi bản ghi trong phạm vi", () => {
    const acc = scoped({ "thu-tien": ["view", "create"] }, [BR1]);
    expect(ownerIsScoped(acc)).toBe(true);
    expect(ownerCanIn(acc, "thu-tien", "create", BR1)).toBe(true);
    expect(ownerCanIn(acc, "thu-tien", "create", BR2)).toBe(false);
    // Bản ghi toàn đơn vị (không chi nhánh) ⇒ chỉ người không bị giới hạn.
    expect(ownerCanIn(acc, "thu-tien", "create", null)).toBe(false);
    expect(ownerCanIn(staff, "thu-tien", "create", null)).toBe(true);
  });

  it("canWriteClaim = tai-san:update + phạm vi của claim", () => {
    expect(canWriteClaim(staff, null)).toBe(true);
    expect(canWriteClaim(scoped(STAFF_DEFAULT_MATRIX, [BR1]), BR1)).toBe(true);
    expect(canWriteClaim(scoped(STAFF_DEFAULT_MATRIX, [BR1]), BR2)).toBe(false);
    expect(canWriteClaim(viewer, BR1)).toBe(false);
    // Có quyền ghi module khác không có nghĩa là xác nhận được tài sản.
    expect(canWriteClaim(scoped({ "ket-qua": ["view", "update"] }, [BR1]), BR1)).toBe(false);
  });
});

describe("canWritePosting", () => {
  const P_BR1 = "br-1";
  const personal: PostingOwnership = { workspace_id: null, branch_id: null, user_id: "u-a" };
  const wsNoBranch: PostingOwnership = { workspace_id: "ws", branch_id: null, user_id: "u-a" };
  const wsBr1: PostingOwnership = { workspace_id: "ws", branch_id: P_BR1, user_id: "u-a" };

  it("hồ sơ cá nhân: chỉ người tạo, bất kể vai trò ở không gian nào", () => {
    expect(canWritePosting(personal, "u-a", null)).toBe(true);
    expect(canWritePosting(personal, "u-b", owner)).toBe(false);
    expect(canWritePosting(personal, null, null)).toBe(false);
  });

  it("hồ sơ không gian: người tạo không còn là thành viên ⇒ không ghi", () => {
    expect(canWritePosting(wsNoBranch, "u-a", null)).toBe(false);
  });

  it("mặc định so-hoa:update; ký gửi truyền module của mình", () => {
    expect(canWritePosting(wsNoBranch, "u-b", staff)).toBe(true);
    expect(canWritePosting(wsBr1, "u-b", viewer)).toBe(false);
    const consignOnly = ownerAccessCtx({ isOwner: false, matrix: { "ky-gui": ["view", "create", "update"] }, branchScope: null });
    expect(canWritePosting(wsBr1, "u-b", consignOnly)).toBe(false);
    expect(canWritePosting(wsBr1, "u-b", consignOnly, "ky-gui", "create")).toBe(true);
  });

  it("bị giới hạn chi nhánh: chỉ hồ sơ thuộc chi nhánh trong phạm vi", () => {
    const acc = scoped(STAFF_DEFAULT_MATRIX, [P_BR1]);
    expect(canWritePosting(wsBr1, "u-b", acc)).toBe(true);
    expect(canWritePosting(wsNoBranch, "u-b", acc)).toBe(false);
    expect(canWritePosting({ ...wsBr1, branch_id: "br-2" }, "u-b", acc)).toBe(false);
  });
});

describe("roleWithinCaller (chống leo quyền)", () => {
  const ketQua = { isSystem: false, matrix: { "ket-qua": ["view", "update"] } as OwnerPermissionMatrix };
  const ownerRole = { isSystem: true, matrix: {} };

  it("Trưởng đơn vị gán được mọi vai trò, kể cả Trưởng đơn vị", () => {
    expect(roleWithinCaller(ownerRole, owner)).toBe(true);
    expect(roleWithinCaller({ isSystem: false, matrix: VIEWER_DEFAULT_MATRIX }, owner)).toBe(true);
  });

  it("người khác chỉ gán vai trò nằm trong quyền mình; không bao giờ gán Trưởng đơn vị", () => {
    expect(roleWithinCaller(ketQua, staff)).toBe(true);
    expect(roleWithinCaller({ isSystem: false, matrix: VIEWER_DEFAULT_MATRIX }, staff)).toBe(true);
    expect(roleWithinCaller({ isSystem: false, matrix: { "thanh-vien": ["view", "create"] } }, staff)).toBe(false);
    expect(roleWithinCaller(ownerRole, staff)).toBe(false);
    expect(roleWithinCaller(ketQua, null)).toBe(false);
  });
});

describe("ownerWsAccessLabel", () => {
  it("tên vai trò của Trạm; trụ sở hiện nhãn chỉ xem", () => {
    expect(ownerWsAccessLabel("Kế toán", "member")).toBe("Kế toán");
    expect(ownerWsAccessLabel("Kế toán", "hq")).toBe("Trụ sở · chỉ xem");
  });
});

describe("ownerPortalName (Phase 15a)", () => {
  const member = (parent: string | null) => ({ accessVia: "member" as const, workspace: { parent_workspace_id: parent } });
  const hqChild = (parent: string) => ({ accessVia: "hq" as const, workspace: { parent_workspace_id: parent } });

  it("trụ sở có Trạm con đọc được ⇒ Tháp Điều Hành", () => {
    expect(ownerPortalName("hq", [member(null), hqChild("hq")])).toBe("Tháp Điều Hành");
  });

  it("chi nhánh / trụ sở chưa liên kết / chưa chọn ⇒ Trạm Điều Hành", () => {
    expect(ownerPortalName("br", [member("hq")])).toBe("Trạm Điều Hành");
    expect(ownerPortalName("hq", [member(null)])).toBe("Trạm Điều Hành");
    expect(ownerPortalName("other", [hqChild("hq")])).toBe("Trạm Điều Hành");
    expect(ownerPortalName(null, [hqChild("hq")])).toBe("Trạm Điều Hành");
  });
});

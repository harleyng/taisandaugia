import { describe, expect, it } from "vitest";
import {
  canWriteClaim,
  canWritePosting,
  isOwnerWsRole,
  ownerWsBranchOk,
  ownerPortalName,
  ownerWsCan,
  type PostingOwnership,
} from "./roles";

// Ma trận phải khớp owner_ws_can ở migration 20260926140447.
describe("ownerWsCan", () => {
  it("Trưởng đơn vị có mọi quyền", () => {
    for (const a of ["read", "write", "manage_members", "manage_workspace", "send_report"] as const) {
      expect(ownerWsCan("owner", a)).toBe(true);
    }
  });

  it("Cán bộ chỉ đọc + ghi", () => {
    expect(ownerWsCan("staff", "read")).toBe(true);
    expect(ownerWsCan("staff", "write")).toBe(true);
    expect(ownerWsCan("staff", "manage_members")).toBe(false);
    expect(ownerWsCan("staff", "manage_workspace")).toBe(false);
    expect(ownerWsCan("staff", "send_report")).toBe(false);
  });

  it("Người xem chỉ đọc; người ngoài không có gì", () => {
    expect(ownerWsCan("viewer", "read")).toBe(true);
    expect(ownerWsCan("viewer", "write")).toBe(false);
    expect(ownerWsCan(null, "read")).toBe(false);
    expect(ownerWsCan(undefined, "read")).toBe(false);
  });
});

describe("ownerWsBranchOk / canWriteClaim", () => {
  const BR1 = "branch-1";
  const BR2 = "branch-2";

  it("Trưởng đơn vị và Cán bộ không giới hạn ghi được mọi claim, kể cả claim không thuộc chi nhánh", () => {
    expect(canWriteClaim({ role: "owner", branchScope: null }, null)).toBe(true);
    expect(canWriteClaim({ role: "staff", branchScope: null }, null)).toBe(true);
    expect(canWriteClaim({ role: "staff", branchScope: null }, BR2)).toBe(true);
  });

  it("Cán bộ bị giới hạn chỉ ghi claim trong phạm vi; claim không thuộc chi nhánh thì không", () => {
    const scoped = { role: "staff" as const, branchScope: [BR1] };
    expect(canWriteClaim(scoped, BR1)).toBe(true);
    expect(canWriteClaim(scoped, BR2)).toBe(false);
    expect(canWriteClaim(scoped, null)).toBe(false);
  });

  it("Người xem không bao giờ ghi, dù phạm vi thế nào", () => {
    expect(canWriteClaim({ role: "viewer", branchScope: null }, BR1)).toBe(false);
    expect(ownerWsBranchOk({ role: null, branchScope: null }, BR1)).toBe(false);
  });
});

describe("isOwnerWsRole", () => {
  it("chỉ nhận 3 vai trò cố định", () => {
    expect(isOwnerWsRole("owner")).toBe(true);
    expect(isOwnerWsRole("viewer")).toBe(true);
    expect(isOwnerWsRole("OWNER")).toBe(false);
    expect(isOwnerWsRole(null)).toBe(false);
  });
});

// Bản sao owner_posting_row_can(…, 'write') — migration 20260926152759.
describe("canWritePosting", () => {
  const P_BR1 = "br-1";
  const personal: PostingOwnership = { workspace_id: null, branch_id: null, user_id: "u-a" };
  const wsNoBranch: PostingOwnership = { workspace_id: "ws", branch_id: null, user_id: "u-a" };
  const wsBr1: PostingOwnership = { workspace_id: "ws", branch_id: P_BR1, user_id: "u-a" };

  it("hồ sơ cá nhân: chỉ người tạo, bất kể vai trò ở không gian nào", () => {
    expect(canWritePosting(personal, "u-a", null)).toBe(true);
    expect(canWritePosting(personal, "u-b", { role: "owner", branchScope: null })).toBe(false);
    expect(canWritePosting(personal, null, null)).toBe(false);
  });

  it("hồ sơ không gian: người tạo không còn là thành viên ⇒ không ghi", () => {
    expect(canWritePosting(wsNoBranch, "u-a", null)).toBe(false);
  });

  it("Trưởng đơn vị / Cán bộ không giới hạn ghi mọi hồ sơ; Người xem không", () => {
    expect(canWritePosting(wsNoBranch, "u-b", { role: "owner", branchScope: null })).toBe(true);
    expect(canWritePosting(wsNoBranch, "u-b", { role: "staff", branchScope: null })).toBe(true);
    expect(canWritePosting(wsBr1, "u-b", { role: "viewer", branchScope: null })).toBe(false);
  });

  it("Cán bộ bị giới hạn: chỉ hồ sơ thuộc chi nhánh trong phạm vi", () => {
    const scoped = { role: "staff" as const, branchScope: [P_BR1] };
    expect(canWritePosting(wsBr1, "u-b", scoped)).toBe(true);
    expect(canWritePosting(wsNoBranch, "u-b", scoped)).toBe(false);
    expect(canWritePosting({ ...wsBr1, branch_id: "br-2" }, "u-b", scoped)).toBe(false);
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

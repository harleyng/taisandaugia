import { describe, expect, it, vi } from "vitest";
import {
  PERSONAL_TENANT,
  pickTenant,
  pickWorkspace,
  readSelectedWorkspace,
  subscribeSelectedWorkspace,
  writeSelectedWorkspace,
} from "./selection";
import { ownerInviteLink } from "./inviteLink";

// Vai trò mặc định: Trưởng đơn vị / Cán bộ (có quyền ghi) / Người xem (chỉ xem).
const m = (workspaceId: string, role: "owner" | "staff" | "viewer", joinedAt: string | null) => ({
  workspaceId,
  isOwner: role === "owner",
  hasWrite: role !== "viewer",
  joinedAt,
});

describe("pickWorkspace", () => {
  const list = [m("ws-viewer", "viewer", "2026-01-01"), m("ws-owner", "owner", "2026-05-01"), m("ws-staff", "staff", "2026-02-01")];

  it("không có thành viên nào ⇒ null", () => {
    expect(pickWorkspace([], "ws-owner")).toBeNull();
  });

  it("giữ lựa chọn đã lưu nếu còn là thành viên", () => {
    expect(pickWorkspace(list, "ws-viewer")?.workspaceId).toBe("ws-viewer");
  });

  it("lựa chọn đã lưu không còn hợp lệ ⇒ ưu tiên Trưởng đơn vị", () => {
    expect(pickWorkspace(list, "ws-da-bi-go")?.workspaceId).toBe("ws-owner");
    expect(pickWorkspace(list, null)?.workspaceId).toBe("ws-owner");
  });

  it("cùng vai trò ⇒ nơi tham gia sớm nhất; thiếu ngày xếp cuối", () => {
    const same = [m("b", "staff", null), m("a", "staff", "2026-03-01"), m("c", "staff", "2026-01-01")];
    expect(pickWorkspace(same, null)?.workspaceId).toBe("c");
  });
});

describe("pickTenant", () => {
  const owner = m("ws-owner", "owner", "2026-05-01");
  const viewer = m("ws-viewer", "viewer", "2026-01-01");
  const kind = (t: ReturnType<typeof pickTenant>) =>
    t === null ? null : t.kind === "personal" ? "personal" : t.membership.workspaceId;

  it("chưa có gì ⇒ null", () => {
    expect(pickTenant([], false, null)).toBeNull();
  });

  it("giữ lựa chọn Cá nhân đã lưu nếu còn tenant cá nhân", () => {
    expect(kind(pickTenant([owner], true, PERSONAL_TENANT))).toBe("personal");
    expect(kind(pickTenant([owner], false, PERSONAL_TENANT))).toBe("ws-owner");
  });

  it("giữ không gian đã lưu nếu còn là thành viên", () => {
    expect(kind(pickTenant([owner, viewer], true, "ws-viewer"))).toBe("ws-viewer");
  });

  it("mặc định: Trưởng đơn vị → Cá nhân → Cán bộ/Người xem", () => {
    expect(kind(pickTenant([viewer, owner], true, null))).toBe("ws-owner");
    // Chủ tài sản cá nhân được mời làm Người xem vẫn về "nhà" của mình.
    expect(kind(pickTenant([viewer], true, null))).toBe("personal");
    expect(kind(pickTenant([viewer], false, "ws-da-bi-go"))).toBe("ws-viewer");
    expect(kind(pickTenant([], true, "ws-da-bi-go"))).toBe("personal");
  });
});

describe("Trạm chi nhánh xem qua liên kết trụ sở (Phase 14)", () => {
  const owner = m("ws-hq", "owner", "2026-05-01");
  const viewer = m("ws-viewer", "viewer", "2026-01-01");
  const linked = { ...m("ws-branch", "viewer", "2025-01-01"), accessVia: "hq" as const };

  it("xếp sau mọi nơi là thành viên, kể cả Người xem tham gia muộn hơn", () => {
    expect(pickWorkspace([linked, viewer], null)?.workspaceId).toBe("ws-viewer");
    expect(pickWorkspace([linked, owner], null)?.workspaceId).toBe("ws-hq");
  });

  it("mặc định không mở trạm con, nhưng giữ lựa chọn đã lưu", () => {
    const kind = (t: ReturnType<typeof pickTenant>) =>
      t === null ? null : t.kind === "personal" ? "personal" : t.membership.workspaceId;
    expect(kind(pickTenant([owner, linked], true, null))).toBe("ws-hq");
    expect(kind(pickTenant([owner, linked], true, "ws-branch"))).toBe("ws-branch");
  });
});

describe("read/write/subscribe", () => {
  // Node ≥ 22 có localStorage riêng (rỗng khi thiếu --localstorage-file) che mất
  // bản của jsdom ⇒ tự cắm một Storage trong bộ nhớ cho từng test.
  const install = (storage: Pick<Storage, "getItem" | "setItem">) =>
    Object.defineProperty(window, "localStorage", { value: storage, configurable: true });

  const memoryStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string): void => {
        map.set(k, v);
      },
    };
  };

  it("lưu theo từng tài khoản và báo cho người nghe trong cùng tab", () => {
    install(memoryStorage());
    const onChange = vi.fn();
    const unsubscribe = subscribeSelectedWorkspace(onChange);
    writeSelectedWorkspace("user-1", "ws-1");
    expect(readSelectedWorkspace("user-1")).toBe("ws-1");
    expect(readSelectedWorkspace("user-2")).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
    writeSelectedWorkspace("user-1", "ws-2");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("storage bị chặn ⇒ đọc trả null, ghi không ném lỗi", () => {
    install({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readSelectedWorkspace("user-1")).toBeNull();
    expect(() => writeSelectedWorkspace("user-1", "ws-1")).not.toThrow();
  });

  it("chưa đăng nhập ⇒ null", () => {
    install(memoryStorage());
    expect(readSelectedWorkspace(null)).toBeNull();
  });
});

describe("ownerInviteLink", () => {
  it("dùng đường dẫn riêng của chủ tài sản, không đụng /loi-moi của tổ chức", () => {
    expect(ownerInviteLink("abc", "https://taisandaugia.vn")).toBe("https://taisandaugia.vn/loi-moi-chu-tai-san/abc");
  });
});

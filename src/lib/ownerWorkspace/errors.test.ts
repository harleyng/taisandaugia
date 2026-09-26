import { describe, expect, it } from "vitest";
import { assertOwnerWsRpcOk, OwnerWsRpcError, ownerWsErrorMessage } from "./errors";

describe("assertOwnerWsRpcOk", () => {
  it("im lặng với {ok:true} và mọi dữ liệu khác", () => {
    expect(() => assertOwnerWsRpcOk({ ok: true, token: "t" })).not.toThrow();
    expect(() => assertOwnerWsRpcOk(null)).not.toThrow();
    expect(() => assertOwnerWsRpcOk([{ ok: false }])).not.toThrow();
  });

  it("{ok:false} ⇒ ném OwnerWsRpcError mang reason, câu tiếng Việt và payload", () => {
    try {
      assertOwnerWsRpcOk({ ok: false, reason: "email_mismatch", invite_email: "a@b.vn" });
      expect.unreachable("phải ném lỗi");
    } catch (err) {
      expect(err).toBeInstanceOf(OwnerWsRpcError);
      expect((err as OwnerWsRpcError).reason).toBe("email_mismatch");
      expect((err as OwnerWsRpcError).details.invite_email).toBe("a@b.vn");
      expect((err as OwnerWsRpcError).message).toBe("Email đăng nhập không khớp với email được mời.");
    }
  });

  it("mã liên kết trụ sở (Phase 14) có câu riêng, không rơi vào câu quản lý thành viên", () => {
    expect(new OwnerWsRpcError("link_already_pending").message).toBe(
      "Đã có yêu cầu liên kết đang chờ chi nhánh trả lời.",
    );
    expect(new OwnerWsRpcError("link_forbidden").message).not.toContain("thành viên");
  });

  it("reason lạ ⇒ câu fallback, không lộ mã kỹ thuật", () => {
    expect(new OwnerWsRpcError("khong_co").message).toBe("Thao tác không thành công. Vui lòng thử lại.");
  });
});

describe("ownerWsErrorMessage", () => {
  it("RLS / forbidden ⇒ câu thiếu quyền", () => {
    expect(ownerWsErrorMessage({ code: "42501", message: "new row violates row-level security policy" })).toBe(
      "Bạn không có quyền thực hiện thao tác này.",
    );
    expect(ownerWsErrorMessage({ message: "forbidden" })).toBe("Bạn không có quyền thực hiện thao tác này.");
  });

  it("OwnerWsRpcError giữ nguyên câu của từ điển", () => {
    expect(ownerWsErrorMessage(new OwnerWsRpcError("already_member"))).toBe(
      "Email này đã là thành viên của không gian.",
    );
  });
});

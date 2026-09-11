import { describe, expect, it } from "vitest";
import { sessionErrorMessage } from "./errors";

describe("sessionErrorMessage", () => {
  it("giữ nguyên câu tiếng Việt do trigger RAISE, kể cả khi mã là 42501", () => {
    expect(
      sessionErrorMessage({ code: "42501", message: "Tin này không thuộc tổ chức của bạn." }),
    ).toBe("Tin này không thuộc tổ chức của bạn.");
  });

  it("dịch vi phạm RLS", () => {
    expect(
      sessionErrorMessage({
        code: "42501",
        message: 'new row violates row-level security policy for table "auction_sessions"',
      }),
    ).toBe("Bạn không có quyền thực hiện thao tác này.");
  });

  it("trùng khoá ⇒ tài sản đã có trong phiên", () => {
    expect(sessionErrorMessage({ code: "23505", message: "duplicate key value" })).toBe(
      "Tài sản này đã có trong phiên.",
    );
  });

  it("thiếu lý do huỷ được nói đích danh, CHECK khác nói chung chung", () => {
    expect(
      sessionErrorMessage({ code: "23514", message: 'violates check constraint "auction_sessions_cancel_reason"' }),
    ).toBe("Vui lòng nhập lý do huỷ phiên.");
    expect(
      sessionErrorMessage({ code: "23514", message: 'violates check constraint "auction_sessions_ends_after_start"' }),
    ).toMatch(/mốc thời gian/);
  });

  it("không có gì để đọc ⇒ câu mặc định", () => {
    expect(sessionErrorMessage(null)).toBe("Có lỗi xảy ra. Vui lòng thử lại.");
  });
});

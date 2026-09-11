import { describe, expect, it } from "vitest";
import { SMS_MAX, composeSms, isSmsSafe, stripDiacritics } from "./sms";

describe("sms", () => {
  it("bỏ dấu cả đ/Đ", () => {
    expect(stripDiacritics("Đấu giá đất ở Hồ Chí Minh")).toBe("Dau gia dat o Ho Chi Minh");
  });

  it("vừa khung thì giữ nguyên mọi phần", () => {
    const sms = composeSms({ lead: "[Bảo Tín] PDG1:", subject: "Nhà phố", details: ["DG 28/09"], link: "https://x.vn/s/1" });
    expect(sms).toBe("[Bao Tin] PDG1: Nha pho DG 28/09 https://x.vn/s/1");
  });

  it("quá dài: bỏ chi tiết từ cuối trước, rồi cắt tiêu đề; lead + link luôn còn", () => {
    const link = "https://taisandaugia.vn/sessions/5e551011-0000-4000-8000-000000000001";
    const sms = composeSms({
      lead: "[Bảo Tín] PDG000123:",
      subject: "Quyền sử dụng đất và tài sản gắn liền với đất tại thửa số 123 tờ bản đồ số 45 phường Bến Nghé",
      details: ["gia KD tu 12,500,000,000d", "xem TS 15/09", "DG 28/09"],
      link,
    });
    expect(sms.length).toBeLessThanOrEqual(SMS_MAX);
    expect(isSmsSafe(sms)).toBe(true);
    expect(sms.startsWith("[Bao Tin] PDG000123:")).toBe(true);
    expect(sms.endsWith(link)).toBe(true);
  });
});

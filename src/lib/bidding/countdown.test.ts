import { describe, expect, it } from "vitest";
import { formatCountdown } from "./countdown";

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatCountdown", () => {
  it("trả null khi lô chưa có mốc đóng", () => {
    expect(formatCountdown(null)).toBeNull();
    expect(formatCountdown(Number.NaN)).toBeNull();
  });

  it("hết giờ là 0, không phải null", () => {
    expect(formatCountdown(0)).toEqual({ text: "Đã hết giờ", urgency: "urgent", showAbsolute: false });
    expect(formatCountdown(-5000)?.text).toBe("Đã hết giờ");
  });

  it("còn hơn một ngày thì đếm theo NGÀY kèm mốc tuyệt đối", () => {
    // Phiên demo PDG000013 đóng 31/12/2026 — hiện HH:MM:SS ở đây là vô nghĩa.
    const r = formatCountdown(110 * DAY);
    expect(r).toEqual({ text: "còn 110 ngày", urgency: "normal", showAbsolute: true });
  });

  it("làm tròn LÊN số ngày", () => {
    expect(formatCountdown(DAY + HOUR)?.text).toBe("còn 2 ngày");
  });

  it("đúng 24h vẫn là mốc ngày", () => {
    expect(formatCountdown(DAY)?.text).toBe("còn 1 ngày");
  });

  it("dưới 24h thì HH:MM:SS", () => {
    expect(formatCountdown(DAY - SEC)).toEqual({ text: "23:59:59", urgency: "normal", showAbsolute: true });
    expect(formatCountdown(2 * HOUR + 3 * MIN + 4 * SEC)?.text).toBe("02:03:04");
  });

  it("dưới 1 giờ bỏ phần giờ và chuyển sang 'soon'", () => {
    expect(formatCountdown(HOUR - SEC)).toEqual({ text: "59:59", urgency: "soon", showAbsolute: false });
  });

  it("đúng 1 giờ vẫn là 'normal' HH:MM:SS", () => {
    expect(formatCountdown(HOUR)).toEqual({ text: "01:00:00", urgency: "normal", showAbsolute: true });
  });

  it("dưới 5 phút là 'urgent' — trùng ngưỡng gia hạn mặc định", () => {
    expect(formatCountdown(5 * MIN)?.urgency).toBe("soon");
    expect(formatCountdown(5 * MIN - SEC)).toEqual({ text: "04:59", urgency: "urgent", showAbsolute: false });
    expect(formatCountdown(9 * SEC)?.text).toBe("00:09");
  });
});

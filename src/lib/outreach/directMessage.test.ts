import { describe, expect, it } from "vitest";
import { composeDirectMessage } from "./directMessage";
import { SMS_MAX, isSmsSafe } from "./sms";
import { LOT1, buildInput } from "./testFixtures";

const input = buildInput();
const threeLots = [
  ...input.lots,
  { ...input.lots[0], id: "a1a1a1a1-0000-4000-8000-000000000003", lot_no: 3, title: "Máy xúc Komatsu" },
];

const base = {
  contactName: "Nguyễn Văn An",
  pitch: "Nhà phố Quận 5 lên phiên đấu giá, giá khởi điểm 12,500,000,000₫.",
  session: input.session,
  org: input.org,
  publicUrl: input.publicUrl,
};

describe("composeDirectMessage", () => {
  it("chỉ nhắc đúng các lô khách khớp", () => {
    const matched = threeLots.filter((l) => l.id === LOT1 || l.lot_no === 3);
    const msg = composeDirectMessage({ ...base, method: "zalo", lots: matched });
    expect(msg).toContain("Lô 1: Nhà phố Quận 5");
    expect(msg).toContain("Lô 3: Máy xúc Komatsu");
    expect(msg).not.toContain("Lô 2");
    expect(msg).toContain("Chào anh/chị Nguyễn Văn An");
  });

  it("bản SMS không dấu, ≤160 ký tự, còn link", () => {
    const msg = composeDirectMessage({ ...base, method: "sms", lots: input.lots.slice(1) });
    expect(isSmsSafe(msg)).toBe(true);
    expect(msg.length).toBeLessThanOrEqual(SMS_MAX);
    expect(msg).toContain(input.publicUrl);
  });

  it("gọi điện dùng dạng kịch bản", () => {
    expect(composeDirectMessage({ ...base, method: "call", lots: input.lots })).toMatch(/^Kịch bản gọi cho Nguyễn Văn An/);
  });
});

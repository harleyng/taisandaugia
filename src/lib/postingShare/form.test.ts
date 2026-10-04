import { describe, expect, it } from "vitest";
import { KEEP_EXPIRY, shareLinkDefaults, shareLinkSchema, toShareLinkInput } from "./form";
import { SHARE_EXPIRY_OPTIONS } from "./status";

const valid = { ...shareLinkDefaults(), label: "Anh Minh – KHDN" };

describe("shareLinkSchema", () => {
  it("mọi lựa chọn thời hạn + 'keep' đều hợp lệ (khớp SHARE_EXPIRY_OPTIONS)", () => {
    for (const expiry of [...SHARE_EXPIRY_OPTIONS.map((o) => o.value), KEEP_EXPIRY]) {
      expect(shareLinkSchema.safeParse({ ...valid, expiry }).success).toBe(true);
    }
  });
  it("bắt buộc tên gợi nhớ; người gửi không bắt buộc khi không hiện liên hệ", () => {
    expect(shareLinkSchema.safeParse({ ...valid, label: "  " }).success).toBe(false);
    expect(shareLinkSchema.safeParse({ ...valid, senderUserId: null }).success).toBe(true);
  });
  it("hiện liên hệ mà chưa chọn người gửi ⇒ lỗi ở ô người gửi", () => {
    const r = shareLinkSchema.safeParse({ ...valid, showSenderContact: true });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["senderUserId"]);
    expect(shareLinkSchema.safeParse({ ...valid, showSenderContact: true, senderUserId: "u1" }).success).toBe(true);
  });
  it("kênh bắt buộc, mặc định Zalo; kênh lạ ⇒ lỗi", () => {
    expect(shareLinkDefaults().channel).toBe("zalo");
    expect(shareLinkSchema.safeParse({ ...valid, channel: "tiktok" }).success).toBe(false);
    expect(toShareLinkInput({ ...valid, channel: "sms" }).input.channel).toBe("sms");
  });
  it("tạo mới: người gửi mặc định là người đang tạo; sửa: giữ người gửi của link", () => {
    expect(shareLinkDefaults(null, "me").senderUserId).toBe("me");
    expect(toShareLinkInput({ ...valid, senderUserId: "u2" }).input.senderUserId).toBe("u2");
  });
});

describe("toShareLinkInput", () => {
  it("'keep' ⇒ không đổi hạn; 'none' ⇒ đổi sang không hết hạn", () => {
    expect(toShareLinkInput({ ...valid, expiry: KEEP_EXPIRY }).changeExpiry).toBe(false);
    const none = toShareLinkInput({ ...valid, expiry: "none" });
    expect(none).toMatchObject({ changeExpiry: true, input: { expiresInDays: null } });
    expect(toShareLinkInput({ ...valid, expiry: "7" }).input.expiresInDays).toBe(7);
  });
});

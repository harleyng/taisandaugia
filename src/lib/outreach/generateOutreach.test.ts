import { describe, expect, it } from "vitest";
import { draftFieldValues, generateOutreach, shortOrgName } from "./generateOutreach";
import { CHANNEL_KEYS, isFieldKey } from "./fieldKeys";
import { lockedTexts, noticeTemplate } from "./noticeTemplate";
import { SMS_MAX, isSmsSafe } from "./sms";
import { LOT1, LOT2, LOT3, buildInput } from "./testFixtures";

describe("generateOutreach", () => {
  const input = buildInput();
  const draft = generateOutreach(input);

  it("tất định: cùng đầu vào ra cùng bản nháp", () => {
    expect(generateOutreach(buildInput())).toEqual(draft);
  });

  it("đổi dữ kiện phiên ⇒ đổi chữ ký", () => {
    const moved = buildInput({ session: { ...input.session, starts_at: "2026-09-29T02:00:00Z" } });
    expect(generateOutreach(moved).signature).not.toBe(draft.signature);
  });

  it("SMS không dấu, không vượt 160 ký tự, giữ mã phiên và link", () => {
    expect(isSmsSafe(draft.channels.sms)).toBe(true);
    expect(draft.channels.sms.length).toBeLessThanOrEqual(SMS_MAX);
    expect(draft.channels.sms).toContain("PDG000123");
    expect(draft.channels.sms).toContain(input.publicUrl);
  });

  it("mọi kênh có mã phiên và link trang phiên", () => {
    for (const c of CHANNEL_KEYS) {
      expect(draft.channels[c], c).toContain("PDG000123");
      expect(draft.channels[c], c).toContain(input.publicUrl);
    }
  });

  it("KHÔNG kênh nào chép câu chữ khoá của thông báo đấu giá", () => {
    const locked = lockedTexts(noticeTemplate()).filter((t) => t.length >= 20);
    expect(locked.length).toBeGreaterThan(5);
    for (const c of CHANNEL_KEYS) {
      for (const text of locked) expect(draft.channels[c].includes(text), `${c} ⊃ "${text}"`).toBe(false);
    }
  });

  it("tiền tách nhóm bằng dấu phẩy, lô liệt kê theo số lô", () => {
    expect(draft.channels.listing).toContain("12,500,000,000₫");
    expect(draft.channels.listing.indexOf("Lô 1:")).toBeLessThan(draft.channels.listing.indexOf("Lô 2:"));
  });

  it("ô 'draft' của thông báo chỉ viết từ dữ kiện có sẵn", () => {
    expect(draft.draftSlots.asset_description).toContain("Lô 1: Nhà phố Quận 5 (nhà phố). Nhà 1 trệt 3 lầu");
    expect(draft.draftSlots.asset_condition).toContain("Lô 1: Đang bỏ trống.");
    expect(draft.draftSlots.asset_condition).toContain("Lô 2: tài sản được giới thiệu theo hiện trạng thực tế");
  });

  it("câu chào đúng các phân khúc được yêu cầu; phân khúc trỏ lô đã gỡ bị bỏ", () => {
    const d = generateOutreach(buildInput({ segments: [`lot:${LOT1}`, `lot:${LOT3}`, "multi"] }));
    expect(Object.keys(d.pitches).sort()).toEqual([`lot:${LOT1}`, "multi"].sort());
    expect(d.pitches[`lot:${LOT1}`]).toContain("Nhà phố Quận 5");
    expect(d.pitches[`lot:${LOT1}`]).not.toContain("Toyota");
  });

  it("hồ sơ vụ việc trống vẫn soạn được", () => {
    const d = generateOutreach(buildInput({ caseFile: buildInput().caseFile && { ...buildInput().caseFile, lots: {}, contact_person: "" } }));
    expect(d.channels.listing).toContain("Nhà phố Quận 5");
  });

  it("mọi field_key sinh ra đều hợp lệ với CHECK của DB", () => {
    const keys = Object.keys(draftFieldValues(draft));
    expect(keys).toContain(`pitch:lot:${LOT2}`);
    for (const k of keys) expect(isFieldKey(k), k).toBe(true);
  });

  it("rút gọn tên tổ chức cho đầu SMS", () => {
    expect(shortOrgName("Công ty Đấu giá Hợp danh Bảo Tín")).toBe("Bảo Tín");
    expect(shortOrgName("Chi nhánh Công ty Đấu giá Hợp danh Việt Nam tại Hải Phòng")).toBe("Việt Nam");
  });
});

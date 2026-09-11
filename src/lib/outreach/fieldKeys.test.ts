import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FIELD_KEY_PATTERN, channelFieldKey, isFieldKey, noticeFieldKey, parseFieldKey, pitchFieldKey } from "./fieldKeys";

const LOT = "f2f2f2f2-0000-4000-8000-000000000001";

describe("fieldKeys", () => {
  it("pattern trùng nguyên văn CHECK trong migration", () => {
    const sql = readFileSync(
      resolve(__dirname, "../../../supabase/migrations/20260912000013_session_outreach.sql"),
      "utf8",
    );
    expect(sql).toContain(`field_key ~ '${FIELD_KEY_PATTERN}'`);
  });

  it("khoá dựng ra luôn hợp lệ và parse ngược đúng", () => {
    expect(parseFieldKey(channelFieldKey("zalo"))).toEqual({ kind: "channel", channel: "zalo" });
    expect(parseFieldKey(noticeFieldKey("asset_description"))).toEqual({ kind: "notice", slot: "asset_description" });
    expect(parseFieldKey(pitchFieldKey(`lot:${LOT}`))).toEqual({ kind: "pitch", segment: `lot:${LOT}` });
    expect(parseFieldKey(pitchFieldKey("multi"))).toEqual({ kind: "pitch", segment: "multi" });
  });

  it("từ chối khoá lạ", () => {
    for (const bad of ["channel:tiktok", "notice:Asset", "pitch:lot:1", "pitch:all", "case_file", ""]) {
      expect(isFieldKey(bad), bad).toBe(false);
      expect(parseFieldKey(bad)).toBeNull();
    }
  });
});

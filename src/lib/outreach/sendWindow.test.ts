import { describe, expect, it } from "vitest";
import { canMarkSent } from "./sendWindow";

// Công thức nguyên văn của outreach_send_window_open (SQL):
//   status='published' AND now < starts_at AND now <= ends_at
//   AND (registration_end_at IS NULL OR now <= registration_end_at)
const sqlTwin = (
  s: { status: string; starts_at: string; ends_at: string; registration_end_at?: string | null },
  now: Date,
) => {
  const t = now.getTime();
  return (
    s.status === "published" &&
    t < Date.parse(s.starts_at) &&
    t <= Date.parse(s.ends_at) &&
    (!s.registration_end_at || t <= Date.parse(s.registration_end_at))
  );
};

const base = {
  status: "published" as const,
  registration_end_at: "2026-09-18T10:00:00Z",
  starts_at: "2026-09-20T02:00:00Z",
  ends_at: "2026-09-20T04:00:00Z",
};

const at = (iso: string) => new Date(iso);

describe("canMarkSent khớp bản SQL ở mọi mốc biên", () => {
  const moments = [
    "2026-09-10T00:00:00Z",
    "2026-09-18T09:59:59.999Z",
    "2026-09-18T10:00:00Z", // đúng hạn nhận hồ sơ — vẫn được (<=)
    "2026-09-18T10:00:00.001Z",
    "2026-09-20T01:59:59Z",
    "2026-09-20T02:00:00Z",
    "2026-09-20T05:00:00Z",
  ];

  for (const iso of moments) {
    it(`có hạn nhận hồ sơ @ ${iso}`, () => {
      expect(canMarkSent(base, at(iso))).toBe(sqlTwin(base, at(iso)));
    });
    it(`không khai hạn nhận hồ sơ @ ${iso}`, () => {
      const s = { ...base, registration_end_at: null as string | null };
      expect(canMarkSent(s, at(iso))).toBe(sqlTwin(s, at(iso)));
    });
  }

  it("đúng hạn nhận hồ sơ vẫn đánh dấu được, qua 1ms thì không", () => {
    expect(canMarkSent(base, at("2026-09-18T10:00:00Z"))).toBe(true);
    expect(canMarkSent(base, at("2026-09-18T10:00:00.001Z"))).toBe(false);
  });

  it("nháp và đã huỷ không bao giờ đánh dấu được", () => {
    const now = at("2026-09-10T00:00:00Z");
    expect(canMarkSent({ ...base, status: "draft" }, now)).toBe(false);
    expect(canMarkSent({ ...base, status: "cancelled" }, now)).toBe(false);
  });
});

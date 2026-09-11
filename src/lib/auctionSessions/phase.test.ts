import { describe, expect, it } from "vitest";
import { sessionBucketOf, sessionPhaseOf } from "./phase";

const at = (iso: string) => new Date(iso);

const base = {
  starts_at: "2026-10-10T09:00:00Z",
  ends_at: "2026-10-10T11:00:00Z",
  registration_end_at: "2026-10-08T17:00:00Z",
};

describe("sessionPhaseOf", () => {
  it("trước hạn nộp hồ sơ ⇒ đang bán hồ sơ", () => {
    expect(sessionPhaseOf(base, at("2026-10-01T00:00:00Z"))).toBe("registration_open");
  });

  it("đúng mốc hạn nộp vẫn còn nhận", () => {
    expect(sessionPhaseOf(base, at("2026-10-08T17:00:00Z"))).toBe("registration_open");
  });

  it("hết hạn nộp, chưa tới giờ đấu ⇒ sắp diễn ra", () => {
    expect(sessionPhaseOf(base, at("2026-10-09T00:00:00Z"))).toBe("upcoming");
  });

  it("không khai hạn nộp ⇒ còn nhận tới giờ đấu", () => {
    expect(
      sessionPhaseOf({ ...base, registration_end_at: null }, at("2026-10-10T08:59:00Z")),
    ).toBe("registration_open");
  });

  it("trong khung giờ đấu ⇒ đang diễn ra, kể cả đúng mốc bắt đầu / kết thúc", () => {
    expect(sessionPhaseOf(base, at("2026-10-10T09:00:00Z"))).toBe("ongoing");
    expect(sessionPhaseOf(base, at("2026-10-10T11:00:00Z"))).toBe("ongoing");
  });

  it("qua giờ kết thúc ⇒ đã kết thúc", () => {
    expect(sessionPhaseOf(base, at("2026-10-10T11:00:01Z"))).toBe("ended");
  });
});

describe("sessionBucketOf", () => {
  const now = at("2026-10-01T00:00:00Z");

  it("nháp và đã huỷ giữ nguyên, không phụ thuộc thời gian", () => {
    expect(sessionBucketOf({ ...base, status: "draft" }, at("2027-01-01T00:00:00Z"))).toBe("draft");
    expect(sessionBucketOf({ ...base, status: "cancelled" }, now)).toBe("cancelled");
  });

  it("đã công bố tách theo giờ kết thúc", () => {
    expect(sessionBucketOf({ ...base, status: "published" }, now)).toBe("published");
    expect(sessionBucketOf({ ...base, status: "published" }, at("2026-10-11T00:00:00Z"))).toBe("ended");
  });
});

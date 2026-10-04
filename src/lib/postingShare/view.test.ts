import { describe, expect, it } from "vitest";
import { mapSharedPostingResponse, type SharedPostingSession } from "./types";
import {
  formatSharePhone,
  heroPriceParts,
  highlightFacts,
  initialsOf,
  legalItems,
  priceAreaBasis,
  registrationLeft,
  sessionCta,
  sessionSubline,
  sessionTimeline,
  sharedLocation,
  splitUnit,
} from "./view";

const now = new Date("2026-10-01T05:00:00Z");
const session: SharedPostingSession = {
  path: "/sessions/x",
  code: "PDG000012",
  title: "Phiên",
  lotNo: 1,
  organizationName: null,
  organizationLogoUrl: null,
  startsAt: "2026-10-20T02:00:00Z",
  endsAt: "2026-10-20T04:00:00Z",
  registrationStartAt: null,
  registrationEndAt: "2026-10-15T10:00:00Z",
  dossierFee: 500000,
  depositAmount: null,
  startingPrice: null,
};

describe("sessionCta", () => {
  it("chưa có phiên ⇒ nhận thông báo; còn hạn đăng ký ⇒ mua hồ sơ; quá hạn ⇒ ended", () => {
    expect(sessionCta(null, now)).toBe("follow");
    expect(sessionCta(session, now)).toBe("dossier");
    expect(sessionCta(session, new Date("2026-10-16T00:00:00Z"))).toBe("ended");
    expect(sessionCta({ ...session, registrationEndAt: null }, new Date("2026-10-21T00:00:00Z"))).toBe("ended");
  });
});

describe("initialsOf / sharedLocation", () => {
  it("chữ cái đầu và cuối của tên đơn vị", () => {
    expect(initialsOf("Ngân hàng TMCP Đầu tư (BIDV)")).toBe("NB");
    expect(initialsOf("Agribank")).toBe("AG");
    expect(initialsOf("  ")).toBe("?");
  });
  it("bỏ phần trống", () => {
    expect(sharedLocation({ location: { address: null, ward: null, district: "Quận 7", province: "TP. HCM" } })).toBe(
      "Quận 7, TP. HCM",
    );
  });
});

describe("mapSharedPostingResponse", () => {
  it("lý do lạ ⇒ not_found; payload thiếu ⇒ giá trị an toàn", () => {
    expect(mapSharedPostingResponse({ ok: false, reason: "weird" })).toEqual({ ok: false, reason: "not_found", expiredAt: null });
    const r = mapSharedPostingResponse({ ok: true, posting: { title: "A", starting_price: "1200000000", sender: null } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.posting.startingPrice).toBe(1_200_000_000);
      expect(r.posting.sender).toBeNull();
      expect(r.posting.imageUrls).toEqual([]);
      expect(r.posting.session).toBeNull();
    }
  });
});

describe("sessionTimeline", () => {
  it("mốc đã qua là done, mốc kế tiếp là now, còn lại todo; bỏ mốc trống", () => {
    expect(sessionTimeline(session, now).map((s) => [s.label, s.state])).toEqual([
      ["Hạn đăng ký", "now"],
      ["Thời gian đấu giá", "todo"],
    ]);
    const s2 = { ...session, registrationStartAt: "2026-09-20T01:00:00Z" };
    expect(sessionTimeline(s2, new Date("2026-10-16T00:00:00Z")).map((s) => s.state)).toEqual(["done", "done", "now"]);
    expect(sessionTimeline(s2, new Date("2026-10-21T00:00:00Z")).every((s) => s.state === "done")).toBe(true);
  });
});

describe("registrationLeft", () => {
  it("ngày → giờ → dưới 1 giờ → null khi quá hạn", () => {
    expect(registrationLeft(session, now)).toBe("14 ngày");
    expect(registrationLeft(session, new Date("2026-10-15T05:00:00Z"))).toBe("5 giờ");
    expect(registrationLeft(session, new Date("2026-10-15T09:30:00Z"))).toBe("dưới 1 giờ");
    expect(registrationLeft(session, new Date("2026-10-15T10:00:00Z"))).toBeNull();
    expect(registrationLeft({ ...session, registrationEndAt: null }, now)).toBeNull();
  });
});

describe("helpers thẻ giá & liên hệ", () => {
  it("dòng phụ phiên, SĐT, diện tích quy giá", () => {
    expect(sessionSubline(session)).toBe("Phiên PDG000012 · Lô 1");
    expect(sessionSubline({ ...session, code: null, lotNo: null })).toBe("Phiên");
    expect(heroPriceParts(8_650_000_000)).toEqual({ value: "8.65", unit: "tỷ" });
    expect(heroPriceParts(450_000_000)).toEqual({ value: "450", unit: "triệu" });
    expect(formatSharePhone("0912345678")).toBe("0912 345 678");
    expect(formatSharePhone("+84 912")).toBe("+84 912");
    expect(priceAreaBasis({ land_area: 86.5, area: 100 })).toEqual({ m2: 86.5, land: true });
    expect(priceAreaBasis({ area: "120" })).toEqual({ m2: 120, land: false });
    expect(priceAreaBasis({ land_area: "", area: 0 })).toBeNull();
  });

  it("facts lấy tối đa 4 giá trị ngắn; tách đơn vị", () => {
    const rows = [
      { k: "Diện tích đất", v: "86,5 m²" },
      { k: "Phù hợp kinh doanh", v: "Cửa hàng, cà phê, homestay phố cổ" },
      { k: "Số tầng", v: "2" },
      { k: "A", v: "1" },
      { k: "B", v: "2" },
      { k: "C", v: "3" },
    ];
    expect(highlightFacts(rows).map((r) => r.k)).toEqual(["Diện tích đất", "Số tầng", "A", "B"]);
    expect(splitUnit("86,5 m²")).toEqual({ value: "86,5", unit: "m²" });
    expect(splitUnit("Sổ đỏ")).toEqual({ value: "Sổ đỏ", unit: null });
  });

  it("pháp lý: vướng là warn, chưa khai là muted", () => {
    const items = legalItems({ rightToSell: true, hasDispute: false, hasMortgage: true, isSeized: null });
    expect(items.map((i) => i.tone)).toEqual(["ok", "ok", "warn", "muted"]);
    expect(items[2].title).toBe("Đang thế chấp");
  });
});

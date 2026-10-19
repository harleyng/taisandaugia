import { describe, expect, it } from "vitest";
import {
  channelLabel,
  isTrackingCode,
  listingTargetPath,
  MKT_CHANNELS,
  MKT_CHANNEL_META,
  readMktAttribution,
  withMktAttribution,
} from "./links";

const LINK_ID = "dfcc44f6-9a89-4b3e-b588-3aaf440ec32c";

describe("mã & đường dẫn", () => {
  it("mã hợp lệ = đúng 8 ký tự [a-z0-9] (khớp CHECK ở DB)", () => {
    expect(isTrackingCode("2abyudez")).toBe(true);
    expect(isTrackingCode("2ABYUDEZ")).toBe(false);
    expect(isTrackingCode("abc")).toBe(false);
    expect(isTrackingCode("../etc/p")).toBe(false);
    expect(isTrackingCode(undefined)).toBe(false);
  });

  it("đích chuyển hướng = trang tin + utm theo kênh và mã", () => {
    expect(listingTargetPath("abc", "zalo", "2abyudez")).toBe("/listings/abc?utm_source=zalo&utm_campaign=2abyudez");
  });
});

describe("kênh", () => {
  it("mọi kênh của CHECK đều có nhãn; kênh lạ ⇒ Khác", () => {
    expect([...MKT_CHANNELS].sort()).toEqual(["bank_app", "email", "facebook", "other", "press", "sms", "zalo"]);
    for (const c of MKT_CHANNELS) expect(MKT_CHANNEL_META[c].label).toBeTruthy();
    expect(channelLabel("bank_app")).toBe("App ngân hàng");
    expect(channelLabel("tiktok")).toBe("Khác");
  });
});

describe("cookie ghi nhận nguồn", () => {
  it("đọc đúng id link, bỏ giá trị không phải uuid", () => {
    expect(readMktAttribution(`a=1; mkt_link_id=${LINK_ID}; b=2`)).toBe(LINK_ID);
    expect(readMktAttribution("mkt_link_id=<script>")).toBeNull();
    expect(readMktAttribution("other=1")).toBeNull();
  });
});

describe("mang nguồn sang sàn (?mkt=)", () => {
  it("gắn vào đường dẫn, giữ query và hash", () => {
    expect(withMktAttribution("/sessions/s1", LINK_ID)).toBe(`/sessions/s1?mkt=${LINK_ID}`);
    expect(withMktAttribution("/payment-result?contract=c1", LINK_ID)).toBe(`/payment-result?contract=c1&mkt=${LINK_ID}`);
    expect(withMktAttribution("/auth/handoff#x", LINK_ID)).toBe(`/auth/handoff?mkt=${LINK_ID}#x`);
  });
  it("không có id hợp lệ hoặc đã có ?mkt= ⇒ giữ nguyên", () => {
    expect(withMktAttribution("/sessions", null)).toBe("/sessions");
    expect(withMktAttribution("/sessions", "<script>")).toBe("/sessions");
    expect(withMktAttribution(`/sessions?mkt=${LINK_ID}`, LINK_ID)).toBe(`/sessions?mkt=${LINK_ID}`);
  });
});

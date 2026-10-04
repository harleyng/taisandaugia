import { describe, expect, it } from "vitest";
import type { PostingShareLink } from "@/lib/postingShare/types";
import { FILTER_ALL, branchOptions, filterShareLinks, summarizeShareLinks, type ShareLinkFilters } from "./filters";
import { assetKey, splitAssetKeys } from "./assets";

const link = (over: Partial<PostingShareLink>): PostingShareLink => ({
  id: "l1",
  code: "Ab3_-xYz0123",
  label: "Anh Minh – KHDN",
  senderUserId: null,
  senderName: null,
  senderPhone: null,
  showPrice: false,
  showExactAddress: false,
  showSenderContact: false,
  expiresAt: null,
  revokedAt: null,
  viewCount: 10,
  uniqueViewCount: 6,
  ctaDossierCount: 2,
  ctaPdfCount: 0,
  ctaFollowCount: 1,
  ctaCallCount: 0,
  lastViewedAt: null,
  createdByName: null,
  createdAt: "2026-10-01T00:00:00Z",
  postingId: "p1",
  listingId: null,
  workspaceId: "w1",
  branchId: "b1",
  branchName: "CN Hà Nội",
  channel: "zalo",
  campaignId: null,
  campaignName: null,
  targetKind: "posting",
  targetTitle: "Nhà phố Đống Đa",
  targetCode: "HS-0001",
  targetImage: null,
  isLegacy: false,
  canManage: true,
  ...over,
});

const ALL: ShareLinkFilters = {
  q: "",
  channel: FILTER_ALL,
  source: FILTER_ALL,
  kind: FILTER_ALL,
  state: FILTER_ALL,
  branch: FILTER_ALL,
  asset: "",
};

const rows = [
  link({}),
  link({
    id: "l2",
    label: "Chiến dịch T10 · SMS",
    channel: "sms",
    campaignId: "c1",
    campaignName: "Đẩy kho bãi",
    targetKind: "listing",
    postingId: null,
    listingId: "t1",
    targetTitle: "Kho bãi Quảng Ninh",
    targetCode: "T1000000",
    branchId: "b2",
    branchName: "CN Quảng Ninh",
  }),
  link({ id: "l3", revokedAt: "2026-10-02T00:00:00Z", viewCount: 4, uniqueViewCount: 4 }),
];
const now = new Date("2026-10-04T00:00:00Z");

describe("filterShareLinks", () => {
  it("lọc kênh, nguồn, loại tài sản, trạng thái, chi nhánh, tài sản", () => {
    expect(filterShareLinks(rows, { ...ALL, channel: "sms" }, now).map((r) => r.id)).toEqual(["l2"]);
    expect(filterShareLinks(rows, { ...ALL, source: "chien-dich" }, now).map((r) => r.id)).toEqual(["l2"]);
    expect(filterShareLinks(rows, { ...ALL, source: "rieng-le" }, now).map((r) => r.id)).toEqual(["l1", "l3"]);
    expect(filterShareLinks(rows, { ...ALL, kind: "tin" }, now).map((r) => r.id)).toEqual(["l2"]);
    expect(filterShareLinks(rows, { ...ALL, state: "thu-hoi" }, now).map((r) => r.id)).toEqual(["l3"]);
    expect(filterShareLinks(rows, { ...ALL, branch: "b2" }, now).map((r) => r.id)).toEqual(["l2"]);
    expect(filterShareLinks(rows, { ...ALL, asset: "t1" }, now).map((r) => r.id)).toEqual(["l2"]);
  });
  it("tìm không dấu theo nhãn, tài sản, mã hồ sơ, chiến dịch", () => {
    expect(filterShareLinks(rows, { ...ALL, q: "kho bai" }, now).map((r) => r.id)).toEqual(["l2"]);
    expect(filterShareLinks(rows, { ...ALL, q: "hs-0001" }, now).map((r) => r.id)).toEqual(["l1", "l3"]);
    expect(filterShareLinks(rows, { ...ALL, q: "day kho" }, now).map((r) => r.id)).toEqual(["l2"]);
  });
});

describe("summarizeShareLinks", () => {
  it("cộng bộ đếm, đếm link đang mở", () => {
    expect(summarizeShareLinks(rows, now)).toEqual({ links: 3, active: 2, views: 24, viewers: 16, dossier: 6, follow: 3 });
  });
});

describe("branchOptions", () => {
  it("chi nhánh có link, không trùng, theo tên", () => {
    expect(branchOptions(rows)).toEqual([
      { id: "b1", name: "CN Hà Nội" },
      { id: "b2", name: "CN Quảng Ninh" },
    ]);
  });
});

describe("assetKey / splitAssetKeys", () => {
  it("tách khoá trộn thành hai danh sách, giữ thứ tự, bỏ khoá hỏng", () => {
    const keys = [assetKey("listing", "t1"), assetKey("posting", "p1"), "rác", assetKey("listing", "t2")];
    expect(splitAssetKeys(keys)).toEqual({ listingIds: ["t1", "t2"], postingIds: ["p1"] });
  });
});

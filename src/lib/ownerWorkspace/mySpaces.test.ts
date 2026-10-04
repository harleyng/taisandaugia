import { describe, expect, it } from "vitest";
import { kycTileStatus, mySpacesState, spaceInitials, type KycTile } from "./mySpaces";

const tile = (status: KycTile["status"]): KycTile => ({
  key: status,
  kind: "organization",
  name: "X",
  status,
  rejectionReason: null,
});

describe("spaceInitials", () => {
  it("bỏ tiền tố pháp lý", () => {
    expect(spaceInitials("Ngân hàng TMCP An Phát")).toBe("AP");
    expect(spaceInitials("Công ty TNHH Minh Đức")).toBe("MĐ");
  });
  it("ưu tiên tên viết tắt ngắn", () => {
    expect(spaceInitials("Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", ["BIDV"])).toBe("BIDV");
    expect(spaceInitials("An Phát – CN Hà Nội", ["Ngân hàng An Phát Hà Nội"])).toBe("AP");
  });
  it("tên toàn từ chung vẫn ra chữ", () => {
    expect(spaceInitials("Ngân hàng")).toBe("NH");
  });
});

describe("kycTileStatus", () => {
  it("đã duyệt không có thẻ trạng thái", () => {
    expect(kycTileStatus("approved")).toBeNull();
    expect(kycTileStatus("under_review")).toBe("pending");
    expect(kycTileStatus("pending_review")).toBe("pending");
  });
});

describe("mySpacesState", () => {
  it("có không gian thắng mọi hồ sơ", () => {
    expect(mySpacesState(1, [tile("rejected")])).toBe("ok");
  });
  it("bị từ chối > chờ duyệt > nháp > chưa có gì", () => {
    expect(mySpacesState(0, [tile("pending"), tile("rejected")])).toBe("rejected");
    expect(mySpacesState(0, [tile("draft"), tile("pending")])).toBe("pending");
    expect(mySpacesState(0, [tile("draft")])).toBe("draft");
    expect(mySpacesState(0, [])).toBe("none");
  });
});

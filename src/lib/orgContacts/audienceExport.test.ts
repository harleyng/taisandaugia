import { describe, expect, it } from "vitest";
import { audienceSheetRows } from "./audienceExport";
import type { AudienceRow } from "@/types/org-contacts";

const row = (over: Partial<AudienceRow>): AudienceRow => ({
  contact_id: "c1",
  code: "LH000001",
  full_name: "Nguyễn A",
  contact_type: "individual",
  company_name: null,
  phone: "0900000001",
  email: null,
  zalo: null,
  province: null,
  notifications_enabled: true,
  status: "active",
  eligible: true,
  group_ids: [],
  matched_item_ids: ["l1"],
  matched_lot_nos: [1],
  reasons: [],
  segment_key: "lot:l1",
  ...over,
});

describe("audienceSheetRows", () => {
  const lots = [
    { id: "l1", lot_no: 1, title: "Nhà phố Q5" },
    { id: "l3", lot_no: 3, title: "Ô tô" },
  ];

  it("chỉ xuất khách đủ điều kiện gửi", () => {
    const aoa = audienceSheetRows(
      [row({}), row({ code: "LH000002", eligible: false, notifications_enabled: false })],
      lots,
      () => undefined,
    );
    expect(aoa).toHaveLength(2);
    expect(aoa[1][0]).toBe("LH000001");
  });

  it("ghi đúng các lô khách đã khớp và tên nhóm", () => {
    const aoa = audienceSheetRows(
      [row({ matched_item_ids: ["l1", "l3"], group_ids: ["g1", "g-xoa"] })],
      lots,
      (id) => (id === "g1" ? "VIP" : undefined),
    );
    expect(aoa[1][6]).toBe("Lô 1: Nhà phố Q5; Lô 3: Ô tô");
    expect(aoa[1][7]).toBe("VIP");
  });
});

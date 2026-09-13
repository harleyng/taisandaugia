// @vitest-environment node
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { minutesPdfBlob } from "./index";
import type { MinutesPdfInput } from "./input";

const input: MinutesPdfInput = {
  session: {
    id: "f10d0009-0000-4000-8000-000000000001",
    code: "PDG000013",
    title: "Phiên đấu giá tài sản [DEMO]",
    startsAt: "2026-10-16T02:00:00Z",
    endsAt: "2026-12-31T10:00:00Z",
    venue: null,
    province: "Đồng Nai",
    auctionFormat: "ca_hai",
    extensionSeconds: 300,
    maxBidSteps: 10,
    finalizedAt: "2026-10-16T05:00:00Z",
  },
  org: { name: "Công ty đấu giá hợp danh Bảo Tín", address: "1 Lê Lợi, Hà Nội", phone: "0900000000" },
  auctioneer: { fullName: "Trần Văn Bình", licenseNumber: "1234/ĐGV" },
  lots: [
    {
      lotNo: 1, title: "Đất thổ cư 88.5m² tại Trung tâm, Đồng Nai",
      startingPrice: 6_400_000_000, bidStep: 50_000_000, bidCount: 3, result: "sold",
      withdrawn: false, withdrawReason: null, winningAmount: 6_450_000_000,
      winnerName: "Phạm Quốc Bảo", winnerBidderNo: 1,
      closedAt: "2026-10-16T04:00:00Z", paymentDueAt: "2026-11-15T04:00:00Z",
    },
    {
      lotNo: 2, title: "Nhà phố 449.6m² tại Đống Đa, Hà Nội",
      startingPrice: 28_450_000_000, bidStep: 200_000_000, bidCount: 0, result: null,
      withdrawn: true, withdrawReason: "Chủ tài sản rút tài sản", winningAmount: null,
      winnerName: null, winnerBidderNo: null, closedAt: null, paymentDueAt: null,
    },
  ],
  dossierCount: 2,
  bidderNoCount: 2,
  generatedAt: new Date(2026, 9, 16, 15, 4, 31),
};

describe("minutesPdfBlob", () => {
  it("dựng ra PDF thật, không chỉ cây nội dung hợp lệ", async () => {
    const blob = await minutesPdfBlob(input);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(3000);
    if (process.env.MINUTES_OUT) writeFileSync(process.env.MINUTES_OUT, bytes);
  }, 30_000);
});

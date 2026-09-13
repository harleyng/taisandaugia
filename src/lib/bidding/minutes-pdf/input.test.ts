import { describe, expect, it } from "vitest";
import { buildMinutesPdfInput, minutesFileName, minutesObjectPath, type BuildMinutesArgs } from "./input";
import type { LotState } from "@/types/auction-bidding";

const HASH = "9f2a11c4bbbbccccddddeeeeffff00001111222233334444555566667777888a";
const AT = new Date(2026, 8, 12, 15, 4, 31); // 12/09/2026 15:04:31 giờ máy

const CCCD = "079085123456";
const ADDRESS = "12 Nguyễn Huệ, Quận 1, TP.HCM";

const state = (lotId: string, o: Partial<LotState> = {}): LotState =>
  ({
    lot_id: lotId,
    session_id: "s1",
    status: "closed",
    result: null,
    winner_contract_id: null,
    winning_amount: null,
    bid_count: 0,
    withdraw_reason: null,
    closed_at: null,
    payment_due_at: null,
    ...o,
  }) as LotState;

const args = (patch: Partial<BuildMinutesArgs> = {}): BuildMinutesArgs => ({
  session: {
    id: "f10d0009-0000-4000-8000-000000000001",
    code: "PDG000013",
    title: "Phiên đấu giá tài sản quý IV",
    startsAt: "2026-10-16T02:00:00Z",
    endsAt: "2026-12-31T10:00:00Z",
    venue: null,
    province: "Đồng Nai",
    auctionFormat: "ca_hai",
    extensionSeconds: 300,
    maxBidSteps: 10,
    finalizedAt: "2026-10-16T05:00:00Z",
  },
  org: { name: "Công ty đấu giá hợp danh Bảo Tín", address: "1 Lê Lợi", phone: "0900000000" },
  auctioneer: { fullName: "Trần Văn Bình", licenseNumber: "1234/ĐGV" },
  lots: [
    { id: "lot1", lot_no: 1, title: "Đất thổ cư 88.5m² — Đồng Nai", starting_price: 6_400_000_000, bid_step: 50_000_000 },
    { id: "lot2", lot_no: 2, title: "Nhà phố 449.6m² — Đống Đa", starting_price: 28_450_000_000, bid_step: 200_000_000 },
  ],
  stateByLot: new Map([
    ["lot1", state("lot1", { result: "sold", winner_contract_id: "c1", winning_amount: 6_450_000_000, bid_count: 3 })],
    ["lot2", state("lot2", { status: "withdrawn", withdraw_reason: "Chủ tài sản rút tài sản" })],
  ]),
  contracts: [
    { id: "c1", status: "paid", full_name: "Nguyễn Văn An", bidder_no: 1, id_number: CCCD, address: ADDRESS },
    { id: "c2", status: "paid", full_name: "Đỗ Thị Hà", bidder_no: 2, id_number: CCCD, address: ADDRESS },
    { id: "c3", status: "cancelled", full_name: "Lê Minh", bidder_no: null, id_number: CCCD, address: ADDRESS },
  ] as unknown as BuildMinutesArgs["contracts"],
  now: AT,
  ...patch,
});

describe("buildMinutesPdfInput", () => {
  it("lấy tên + số báo danh của người trúng, KHÔNG lấy CCCD hay địa chỉ", () => {
    const input = buildMinutesPdfInput(args());
    const lot1 = input.lots[0];
    expect(lot1.winnerName).toBe("Nguyễn Văn An");
    expect(lot1.winnerBidderNo).toBe(1);

    const dump = JSON.stringify(input);
    expect(dump).not.toContain(CCCD);
    expect(dump).not.toContain(ADDRESS);
  });

  it("lô không bán được thì không có người trúng", () => {
    const input = buildMinutesPdfInput(
      args({ stateByLot: new Map([["lot1", state("lot1", { result: "unsold", bid_count: 0 })]]) }),
    );
    expect(input.lots[0]).toMatchObject({ result: "unsold", winnerName: null, winningAmount: null });
  });

  it("lô đã rút mang theo lý do", () => {
    const lot2 = buildMinutesPdfInput(args()).lots[1];
    expect(lot2.withdrawn).toBe(true);
    expect(lot2.withdrawReason).toBe("Chủ tài sản rút tài sản");
  });

  it("đếm hồ sơ: chỉ hồ sơ đã thanh toán, và bao nhiêu đã có số báo danh", () => {
    const input = buildMinutesPdfInput(args());
    expect(input.dossierCount).toBe(2);
    expect(input.bidderNoCount).toBe(2);
  });

  it("xếp lô theo số lô dù đầu vào lộn xộn", () => {
    const a = args();
    const input = buildMinutesPdfInput({ ...a, lots: [a.lots[1], a.lots[0]] });
    expect(input.lots.map((l) => l.lotNo)).toEqual([1, 2]);
  });

  it("phiên chưa chốt kết quả thì từ chối lập biên bản", () => {
    const a = args();
    expect(() => buildMinutesPdfInput({ ...a, session: { ...a.session, finalizedAt: null } })).toThrow(
      /chưa chốt kết quả/,
    );
  });
});

describe("minutesFileName", () => {
  it("khớp đúng regex mà org_issue_minutes kiểm", () => {
    expect(minutesFileName("PDG000013", "f10d0009", HASH, AT)).toMatch(/^[A-Za-z0-9._-]+\.pdf$/);
  });

  it("dựng đúng dạng bien-ban_MÃ_thờiđiểm_hash8.pdf", () => {
    expect(minutesFileName("PDG000013", "f10d0009", HASH, AT)).toBe("bien-ban_PDG000013_20260912150431_9f2a11c4.pdf");
  });

  it("mã null lùi về 8 ký tự đầu của id phiên, không ra chữ 'null'", () => {
    const name = minutesFileName(null, "f10d0009-0000-4000-8000-000000000001", HASH, AT);
    expect(name).toContain("f10d0009");
    expect(name).not.toContain("null");
  });

  it("mã có dấu / khoảng trắng bị lọc sạch, vẫn khớp regex", () => {
    const name = minutesFileName("Phiên số 13/2026", "f10d0009", HASH, AT);
    expect(name).toMatch(/^[A-Za-z0-9._-]+\.pdf$/);
  });

  it("hai lần phát hành khác giây cho tên khác nhau", () => {
    const later = new Date(AT.getTime() + 1000);
    expect(minutesFileName("PDG000013", "s", HASH, AT)).not.toBe(minutesFileName("PDG000013", "s", HASH, later));
  });
});

describe("minutesObjectPath", () => {
  it("đúng 3 đoạn, đoạn đầu là id tổ chức", () => {
    const path = minutesObjectPath("org-1", "sess-1", "bien-ban_x.pdf");
    expect(path.split("/")).toEqual(["org-1", "sess-1", "bien-ban_x.pdf"]);
  });
});

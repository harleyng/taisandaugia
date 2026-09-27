import { describe, expect, it } from "vitest";
import {
  PIPELINE_STAGES,
  daysInStage,
  groupPipeline,
  isStageOverdue,
  resolvePipelineStage,
  toPipelineCard,
  type PipelineFacts,
  type PipelinePrep,
  type PipelineRound,
} from "./ownerPipeline";

// 26/09/2026 15:00 giờ máy — mọi phép tính "N ngày" dựa trên mốc này.
const NOW = new Date(2026, 8, 26, 15, 0, 0);

const prep = (over: Partial<PipelinePrep> = {}): PipelinePrep => ({
  draft: false,
  reviewStatus: "approved",
  requestedAt: null,
  quotedCount: 0,
  brokerActive: false,
  restartedAt: null,
  orgSelectedAt: null,
  contract: null,
  ...over,
});

const round = (state: PipelineRound["state"], over: Partial<PipelineRound> = {}): PipelineRound => ({
  state,
  at: "2026-09-20",
  ...over,
});

const posting = (over: Partial<PipelineFacts> = {}): PipelineFacts => ({
  kind: "posting",
  id: "p1",
  title: "Nhà đất Q.7",
  href: "/chu-tai-san/dang-tai-san/p1",
  startingPrice: 5_000_000_000,
  createdAt: "2026-09-01",
  prep: prep(),
  round: null,
  prior: null,
  ...over,
});

const listing = (over: Partial<PipelineFacts> = {}): PipelineFacts => ({
  kind: "listing",
  id: "l1",
  title: "Căn hộ Thủ Đức",
  href: "/listings/l1",
  startingPrice: 3_000_000_000,
  createdAt: "2026-09-10",
  prep: null,
  round: round("announced", { at: "2026-09-10", startsAt: "2026-10-05", phaseLabel: "Đang bán hồ sơ" }),
  prior: null,
  ...over,
});

describe("resolvePipelineStage — lượt đã bán", () => {
  it("R1: winner defaulted ⇒ Không thành, from the default date", () => {
    const r = resolvePipelineStage(
      listing({ round: round("sold", { payment: "defaulted", paymentAt: "2026-09-24" }) }),
    );
    expect(r).toEqual({ stage: "khong_thanh", since: "2026-09-24", detail: "Người trúng bỏ cọc" });
    expect(resolvePipelineStage(listing({ round: round("sold", { payment: "defaulted" }) })).since).toBe(
      "2026-09-20",
    );
  });

  it("R2: paid in full ⇒ Đã thu tiền, from the payment date", () => {
    expect(
      resolvePipelineStage(listing({ round: round("sold", { payment: "paid", paymentAt: "2026-09-25" }) })),
    ).toEqual({ stage: "da_thu_tien", since: "2026-09-25", detail: null });
  });

  it("R2: a finished sale contract counts as paid even before the lot flips", () => {
    const r = resolvePipelineStage(
      posting({ round: round("sold", { payment: "pending", sale: { stage: "done", at: "2026-09-23" } }) }),
    );
    expect(r).toMatchObject({ stage: "da_thu_tien", since: "2026-09-23" });
  });

  it.each([
    [{ sale: { stage: "signing" as const, at: "2026-09-21" } }, "Đang ký hợp đồng", "2026-09-21"],
    [{ sale: { stage: "paying" as const, at: "2026-09-22" } }, "Đang thanh toán", "2026-09-22"],
    [{ payment: "partial" as const }, "Đã thu một phần", "2026-09-20"],
    [
      { payment: "partial" as const, sale: { stage: "paying" as const, at: "2026-09-22" } },
      "Đã thu một phần",
      "2026-09-22",
    ],
  ])("R3: live sale contract or partial payment ⇒ HĐ mua bán (%#)", (over, detail, since) => {
    expect(resolvePipelineStage(listing({ round: round("sold", over) }))).toEqual({
      stage: "hd_mua_ban",
      since,
      detail,
    });
  });

  it.each([
    [{ payment: "pending" as const }, "Chờ thu tiền", "2026-09-20"],
    [{ payment: null }, "Chưa rõ thanh toán", "2026-09-20"],
    [{ payment: "pending" as const, saleCancelledAt: "2026-09-23T04:00:00Z" }, "HĐ mua bán đã huỷ", "2026-09-23T04:00:00Z"],
  ])("R4: won with no sale contract ⇒ Trúng (%#)", (over, detail, since) => {
    expect(resolvePipelineStage(listing({ round: round("sold", over) }))).toEqual({
      stage: "trung",
      since,
      detail,
    });
  });
});

describe("resolvePipelineStage — nhánh thất bại & phiên", () => {
  it("R5: unsold with nothing scheduled ⇒ Không thành", () => {
    expect(
      resolvePipelineStage(listing({ round: round("unsold", { sessionCode: "PDG000013" }) })),
    ).toEqual({ stage: "khong_thanh", since: "2026-09-20", detail: "PDG000013 · Chưa có lịch đấu lại" });
  });

  it.each([
    ["postponed", "Hoãn"],
    ["cancelled", "Huỷ phiên"],
    ["withdrawn", "Rút khỏi phiên"],
  ] as const)("R6: %s session ⇒ Chờ đấu lại", (voidKind, detail) => {
    expect(resolvePipelineStage(listing({ round: round("void", { voidKind }) }))).toEqual({
      stage: "cho_dau_lai",
      since: "2026-09-20",
      detail,
    });
  });

  it("R7: live session ⇒ Phiên", () => {
    expect(
      resolvePipelineStage(posting({ round: round("live", { at: "2026-09-26T07:00:00Z", sessionCode: "PDG000012" }) })),
    ).toEqual({ stage: "phien", since: "2026-09-26T07:00:00Z", detail: "PDG000012 · Đang diễn ra" });
  });

  it("R8: session over without a result ⇒ Phiên · Chờ kết quả", () => {
    expect(resolvePipelineStage(listing({ round: round("awaiting_result") }))).toEqual({
      stage: "phien",
      since: "2026-09-20",
      detail: "Chờ kết quả",
    });
  });

  it("R9: new round announced after an earlier one ⇒ Chờ đấu lại, from the failed round", () => {
    expect(resolvePipelineStage(listing({ prior: { at: "2026-08-15" } }))).toEqual({
      stage: "cho_dau_lai",
      since: "2026-08-15",
      detail: "Lịch đấu lại 05/10",
    });
    const noDates = resolvePipelineStage(
      listing({ prior: { at: null }, round: round("announced", { at: "2026-09-10", startsAt: null }) }),
    );
    expect(noDates).toEqual({ stage: "cho_dau_lai", since: "2026-09-10", detail: "Đã có lịch đấu lại" });
  });

  it("R10: first announcement ⇒ Niêm yết with the phase and auction day", () => {
    expect(resolvePipelineStage(listing())).toEqual({
      stage: "niem_yet",
      since: "2026-09-10",
      detail: "Đang bán hồ sơ · 05/10",
    });
    const bare = resolvePipelineStage(listing({ round: round("announced", { phaseLabel: null, startsAt: null }) }));
    expect(bare.detail).toBe("Đã công bố");
  });
});

describe("resolvePipelineStage — trước phiên (hồ sơ số hoá)", () => {
  it("R11: signed service contract, not in a published session yet ⇒ HĐ dịch vụ", () => {
    const f = posting({
      prep: prep({ contract: { status: "signed", createdAt: "2026-09-02", signedAt: "2026-09-08" } }),
    });
    expect(resolvePipelineStage(f)).toEqual({
      stage: "hd_dich_vu",
      since: "2026-09-08",
      detail: "Đã ký · chờ niêm yết",
    });
  });

  it.each([
    ["drafting", "Đang soạn hợp đồng"],
    ["awaiting_signatures", "Chờ ký hợp đồng"],
    ["awaiting_confirmation", "Chờ xác nhận bản ký"],
  ] as const)("R12: open contract (%s) ⇒ HĐ dịch vụ from creation", (status, detail) => {
    const f = posting({ prep: prep({ contract: { status, createdAt: "2026-09-05", signedAt: null } }) });
    expect(resolvePipelineStage(f)).toEqual({ stage: "hd_dich_vu", since: "2026-09-05", detail });
  });

  it("R13: organisation chosen without a contract (old data) ⇒ HĐ dịch vụ", () => {
    expect(resolvePipelineStage(posting({ prep: prep({ orgSelectedAt: "2026-09-04" }) }))).toEqual({
      stage: "hd_dich_vu",
      since: "2026-09-04",
      detail: "Chờ lập hợp đồng",
    });
  });

  it.each([
    [{ requestedAt: "2026-09-03", quotedCount: 2 }, "2 báo giá", "2026-09-03"],
    [{ requestedAt: "2026-09-03", brokerActive: true }, "Sàn đang chọn giúp", "2026-09-03"],
    [{ requestedAt: "2026-09-03" }, "Chờ báo giá", "2026-09-03"],
    [{ requestedAt: "2026-09-03", restartedAt: "2026-09-18" }, "Chờ báo giá", "2026-09-18"],
  ])("R14: quotes requested ⇒ Chọn tổ chức (%#)", (over, detail, since) => {
    expect(resolvePipelineStage(posting({ prep: prep(over) }))).toEqual({
      stage: "chon_to_chuc",
      since,
      detail,
    });
  });

  it.each([
    [{ draft: true, reviewStatus: "pending" as const }, "Bản nháp"],
    [{ reviewStatus: "pending" as const }, "Chờ duyệt"],
    [{ reviewStatus: "approved" as const }, "Đã duyệt"],
    [{ reviewStatus: "rejected" as const }, "Bị từ chối"],
    [{ reviewStatus: null }, null],
  ])("R15: nothing sent yet ⇒ Số hoá (%#)", (over, detail) => {
    expect(resolvePipelineStage(posting({ prep: prep(over) }))).toEqual({
      stage: "so_hoa",
      since: "2026-09-01",
      detail,
    });
  });

  it("R16: a listing with no round falls back to Niêm yết", () => {
    expect(resolvePipelineStage(listing({ round: null }))).toEqual({
      stage: "niem_yet",
      since: "2026-09-10",
      detail: null,
    });
  });

  it("a current round wins over a signed service contract", () => {
    const f = posting({
      prep: prep({ contract: { status: "signed", createdAt: "2026-09-02", signedAt: "2026-09-08" } }),
      round: round("live"),
    });
    expect(resolvePipelineStage(f).stage).toBe("phien");
  });
});

describe("daysInStage / isStageOverdue", () => {
  it("counts whole calendar days, never negative", () => {
    expect(daysInStage("2026-09-20", NOW)).toBe(6);
    expect(daysInStage(new Date(2026, 8, 26, 9).toISOString(), NOW)).toBe(0);
    expect(daysInStage("2026-10-01", NOW)).toBe(0);
  });

  it("has no value without a usable date", () => {
    expect(daysInStage(null, NOW)).toBeNull();
    expect(daysInStage("sắp tới", NOW)).toBeNull();
  });

  it("is overdue only strictly past the stage limit; the final stage never is", () => {
    expect(isStageOverdue("phien", 7)).toBe(false);
    expect(isStageOverdue("phien", 8)).toBe(true);
    expect(isStageOverdue("da_thu_tien", 999)).toBe(false);
    expect(isStageOverdue("so_hoa", null)).toBe(false);
  });
});

describe("toPipelineCard", () => {
  it("shows the winning price on sold stages and the starting price elsewhere", () => {
    const sold = toPipelineCard(listing({ round: round("sold", { payment: "pending", price: 3_500_000_000 }) }), NOW);
    expect(sold).toMatchObject({ stage: "trung", price: 3_500_000_000, priceKind: "winning", days: 6 });
    const unsold = toPipelineCard(listing({ round: round("unsold", { price: 1 }) }), NOW);
    expect(unsold).toMatchObject({ price: 3_000_000_000, priceKind: "starting" });
    const soldNoPrice = toPipelineCard(listing({ round: round("sold", { payment: "pending" }) }), NOW);
    expect(soldNoPrice).toMatchObject({ price: 3_000_000_000, priceKind: "starting" });
  });

  it("hồ sơ ở Chọn tổ chức / HĐ dịch vụ mở trang Ký gửi, cột khác mở hồ sơ số hoá", () => {
    const choosing = toPipelineCard(posting({ prep: prep({ requestedAt: "2026-09-03", quotedCount: 2 }) }), NOW);
    expect(choosing).toMatchObject({ stage: "chon_to_chuc", href: "/chu-tai-san/ky-gui-dau-gia/p1" });
    const contract = toPipelineCard(posting({ prep: prep({ orgSelectedAt: "2026-09-04" }) }), NOW);
    expect(contract).toMatchObject({ stage: "hd_dich_vu", href: "/chu-tai-san/ky-gui-dau-gia/p1" });
    const digitizing = toPipelineCard(posting(), NOW);
    expect(digitizing).toMatchObject({ stage: "so_hoa", href: "/chu-tai-san/dang-tai-san/p1" });
  });

  it("flags a card that sat too long", () => {
    const stuck = toPipelineCard(listing({ round: round("awaiting_result", { at: "2026-09-10" }) }), NOW);
    expect(stuck).toMatchObject({ stage: "phien", days: 16, overdue: true });
  });
});

describe("groupPipeline", () => {
  const facts: PipelineFacts[] = [
    posting({ id: "p-new", createdAt: "2026-09-25" }),
    posting({ id: "p-old", title: "B", createdAt: "2026-08-01" }),
    posting({ id: "p-mid", title: "A", createdAt: "2026-09-20" }),
    listing({ id: "l-paid-old", round: round("sold", { payment: "paid", paymentAt: "2026-09-01" }) }),
    listing({ id: "l-paid-new", round: round("sold", { payment: "paid", paymentAt: "2026-09-25" }) }),
    listing({ id: "l-unsold", round: round("unsold") }),
    listing({ id: "l-listed" }),
  ];

  it("returns all 10 columns in order and puts every asset in exactly one", () => {
    const board = groupPipeline(facts, NOW);
    expect(board.columns.map((c) => c.stage)).toEqual([...PIPELINE_STAGES]);
    const ids = board.columns.flatMap((c) => c.cards.map((x) => x.id));
    expect(ids).toHaveLength(facts.length);
    expect(new Set(ids).size).toBe(facts.length);
    expect(board.total).toBe(facts.length);
  });

  it("sorts overdue first, then longest wait; paid assets newest first", () => {
    const board = groupPipeline(facts, NOW);
    const soHoa = board.columns.find((c) => c.stage === "so_hoa")!;
    expect(soHoa.cards.map((c) => c.id)).toEqual(["p-old", "p-mid", "p-new"]);
    expect(soHoa.cards[0].overdue).toBe(true);
    expect(soHoa.overdueCount).toBe(1);
    const paid = board.columns.find((c) => c.stage === "da_thu_tien")!;
    expect(paid.cards.map((c) => c.id)).toEqual(["l-paid-new", "l-paid-old"]);
    expect(board.overdueCount).toBe(1);
  });

  it("keeps empty columns so the layout stays stable", () => {
    const board = groupPipeline([], NOW);
    expect(board.columns).toHaveLength(PIPELINE_STAGES.length);
    expect(board.columns.every((c) => c.cards.length === 0)).toBe(true);
    expect(board.total).toBe(0);
  });
});

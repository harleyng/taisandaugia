import { describe, expect, it } from "vitest";
import { groupPipeline, resolvePipelineStage } from "./ownerPipeline";
import {
  claimToFacts,
  collectPipelineFacts,
  postingToFacts,
  type PipelineLotRow,
  type PipelineLotStateRow,
  type PipelinePostingRow,
  type PipelineSaleRow,
  type PipelineSessionRow,
} from "./ownerPipelineFacts";
import type { ResolvedAssetOutcome } from "./ownerOutcomes";
import type { AssetOwnerClaim } from "@/types/asset-owner";

// 26/09/2026 15:00 giờ máy.
const NOW = new Date(2026, 8, 26, 15, 0, 0);
/** Mốc giờ máy ⇒ ISO — test không phụ thuộc múi giờ của máy chạy. */
const at = (m: number, d: number, h = 9) => new Date(2026, m - 1, d, h).toISOString();

// ─── Hồ sơ số hoá ────────────────────────────────────────────────────────────

const postingRow = (over: Partial<PipelinePostingRow> = {}): PipelinePostingRow => ({
  id: "p1",
  title: "Nhà đất Q.7",
  status: "active",
  review_status: "approved",
  starting_price: 5_000_000_000,
  chosen_org_id: null,
  created_at: at(9, 1),
  updated_at: at(9, 2),
  requests: [],
  brokers: [],
  contracts: [],
  lots: [],
  ...over,
});

const session = (over: Partial<PipelineSessionRow> = {}): PipelineSessionRow => ({
  status: "published",
  code: "PDG000012",
  starts_at: at(10, 5),
  ends_at: at(10, 5, 11),
  registration_end_at: at(10, 1),
  published_at: at(9, 15),
  updated_at: at(9, 15),
  ...over,
});

const lotState = (over: Partial<PipelineLotStateRow> = {}): PipelineLotStateRow => ({
  status: "closed",
  result: "sold",
  winning_amount: 6_000_000_000,
  payment_status: "pending",
  payment_confirmed_at: null,
  closed_at: at(9, 20),
  updated_at: at(9, 20),
  ...over,
});

const sale = (over: Partial<PipelineSaleRow> = {}): PipelineSaleRow => ({
  status: "drafting",
  price: 6_100_000_000,
  created_at: at(9, 21),
  signed_at: null,
  paid_at: null,
  completed_at: null,
  cancelled_at: null,
  cancel_kind: null,
  ...over,
});

const lot = (over: Partial<PipelineLotRow> = {}): PipelineLotRow => ({
  id: "lot1",
  created_at: at(9, 10),
  session: session(),
  state: null,
  sales: [],
  ...over,
});

/** Hồ sơ đã ký HĐ dịch vụ — nền cho các ca có lô. */
const signed: Pick<PipelinePostingRow, "contracts"> = {
  contracts: [{ status: "signed", created_at: at(9, 3), signed_at: at(9, 8), cancelled_at: null }],
};

const stageOf = (row: PipelinePostingRow) => resolvePipelineStage(postingToFacts(row, NOW)!);

describe("postingToFacts — trước phiên", () => {
  it("leaves cancelled postings off the board", () => {
    expect(postingToFacts(postingRow({ status: "cancelled" }), NOW)).toBeNull();
  });

  it("maps identity, link and starting price", () => {
    expect(postingToFacts(postingRow(), NOW)).toMatchObject({
      kind: "posting",
      id: "p1",
      href: "/chu-tai-san/dang-tai-san/p1",
      startingPrice: 5_000_000_000,
      round: null,
      prior: null,
    });
    expect(postingToFacts(postingRow({ title: "", starting_price: null }), NOW)).toMatchObject({
      title: "Hồ sơ chưa đặt tên",
      startingPrice: null,
    });
  });

  it("a draft stays in Số hoá", () => {
    expect(stageOf(postingRow({ status: "draft", review_status: "pending" }))).toMatchObject({
      stage: "so_hoa",
      detail: "Bản nháp",
    });
  });

  it("counts quotes from the earliest request", () => {
    const r = stageOf(
      postingRow({
        requests: [
          { status: "quoted", created_at: at(9, 10), updated_at: at(9, 12), reopened_at: null },
          { status: "declined", created_at: at(9, 5), updated_at: at(9, 6), reopened_at: null },
        ],
      }),
    );
    expect(r).toEqual({ stage: "chon_to_chuc", since: at(9, 5), detail: "1 báo giá" });
  });

  it("an active 'ask the platform' request counts; a cancelled one does not", () => {
    expect(stageOf(postingRow({ brokers: [{ status: "sourcing", created_at: at(9, 7) }] }))).toEqual({
      stage: "chon_to_chuc",
      since: at(9, 7),
      detail: "Sàn đang chọn giúp",
    });
    expect(stageOf(postingRow({ brokers: [{ status: "cancelled", created_at: at(9, 7) }] })).stage).toBe(
      "so_hoa",
    );
  });

  it("an open service contract ⇒ HĐ dịch vụ; a cancelled one restarts Chọn tổ chức", () => {
    expect(
      stageOf(postingRow({ contracts: [{ status: "drafting", created_at: at(9, 9), signed_at: null, cancelled_at: null }] })),
    ).toEqual({ stage: "hd_dich_vu", since: at(9, 9), detail: "Đang soạn hợp đồng" });

    const restarted = stageOf(
      postingRow({
        requests: [{ status: "quoted", created_at: at(9, 3), updated_at: at(9, 18), reopened_at: at(9, 18) }],
        contracts: [{ status: "cancelled", created_at: at(9, 9), signed_at: null, cancelled_at: at(9, 18) }],
      }),
    );
    expect(restarted).toEqual({ stage: "chon_to_chuc", since: at(9, 18), detail: "1 báo giá" });
  });

  it("old data: a selected request or a legacy status without a contract ⇒ HĐ dịch vụ", () => {
    expect(
      stageOf(postingRow({ requests: [{ status: "accepted", created_at: at(9, 3), updated_at: at(9, 4), reopened_at: null }] })),
    ).toEqual({ stage: "hd_dich_vu", since: at(9, 4), detail: "Chờ lập hợp đồng" });
    expect(stageOf(postingRow({ status: "contracted" }))).toMatchObject({ stage: "hd_dich_vu", since: at(9, 2) });
    expect(stageOf(postingRow({ chosen_org_id: "org1" }))).toMatchObject({ stage: "hd_dich_vu", since: at(9, 2) });
  });

  it("ignores lots in draft sessions and lots whose session is unreadable", () => {
    const row = postingRow({
      ...signed,
      lots: [lot({ session: session({ status: "draft" }) }), lot({ id: "lot2", session: null })],
    });
    expect(postingToFacts(row, NOW)?.round).toBeNull();
    expect(stageOf(row)).toEqual({ stage: "hd_dich_vu", since: at(9, 8), detail: "Đã ký · chờ niêm yết" });
  });
});

describe("postingToFacts — lô trên sàn", () => {
  it("published and still taking registrations ⇒ Niêm yết from publication", () => {
    expect(stageOf(postingRow({ ...signed, lots: [lot()] }))).toEqual({
      stage: "niem_yet",
      since: at(9, 15),
      detail: "Đang bán hồ sơ · 05/10",
    });
    const closedReg = stageOf(
      postingRow({ ...signed, lots: [lot({ session: session({ registration_end_at: at(9, 25) }) })] }),
    );
    expect(closedReg.detail).toBe("Sắp diễn ra · 05/10");
  });

  it("session under way ⇒ Phiên · Đang diễn ra", () => {
    const live = session({ starts_at: at(9, 26, 14), ends_at: at(9, 26, 18), registration_end_at: at(9, 24) });
    expect(stageOf(postingRow({ ...signed, lots: [lot({ session: live })] }))).toEqual({
      stage: "phien",
      since: at(9, 26, 14),
      detail: "PDG000012 · Đang diễn ra",
    });
  });

  it.each([
    ["no lot state (in-person)", null],
    ["lot still open", { status: "open" as const, result: null }],
    ["lot paused", { status: "paused" as const, result: null }],
  ])("session over with %s ⇒ Phiên · Chờ kết quả", (_label, state) => {
    const past = session({ starts_at: at(9, 20), ends_at: at(9, 20, 11), registration_end_at: at(9, 18) });
    const row = postingRow({ ...signed, lots: [lot({ session: past, state: state ? lotState(state) : null })] });
    expect(stageOf(row)).toEqual({ stage: "phien", since: at(9, 20), detail: "PDG000012 · Chờ kết quả" });
  });

  it("a cancelled session beats a sold lot ⇒ Chờ đấu lại", () => {
    const row = postingRow({
      ...signed,
      lots: [lot({ session: session({ status: "cancelled", updated_at: at(9, 22) }), state: lotState() })],
    });
    expect(stageOf(row)).toEqual({ stage: "cho_dau_lai", since: at(9, 22), detail: "PDG000012 · Huỷ phiên" });
  });

  it("withdrawn lot ⇒ Chờ đấu lại; closed unsold ⇒ Không thành", () => {
    expect(
      stageOf(postingRow({ ...signed, lots: [lot({ state: lotState({ status: "withdrawn", result: null }) })] })),
    ).toMatchObject({ stage: "cho_dau_lai", since: at(9, 20), detail: "PDG000012 · Rút khỏi phiên" });
    expect(stageOf(postingRow({ ...signed, lots: [lot({ state: lotState({ result: "unsold" }) })] }))).toEqual({
      stage: "khong_thanh",
      since: at(9, 20),
      detail: "PDG000012 · Chưa có lịch đấu lại",
    });
  });

  it("sold without a sale contract ⇒ Trúng, priced from the winning amount", () => {
    const f = postingToFacts(postingRow({ ...signed, lots: [lot({ state: lotState() })] }), NOW)!;
    expect(f.round).toMatchObject({ state: "sold", price: 6_000_000_000, payment: "pending" });
    expect(resolvePipelineStage(f)).toEqual({ stage: "trung", since: at(9, 20), detail: "Chờ thu tiền" });
  });

  it.each([
    [sale(), "hd_mua_ban", at(9, 21), "Đang ký hợp đồng"],
    [sale({ status: "signed", signed_at: at(9, 22) }), "hd_mua_ban", at(9, 22), "Đang thanh toán"],
    [sale({ status: "signed", signed_at: at(9, 22), paid_at: at(9, 24) }), "da_thu_tien", at(9, 24), null],
    [sale({ status: "completed", paid_at: at(9, 24), completed_at: at(9, 25) }), "da_thu_tien", at(9, 25), null],
  ])("sale contract %# ⇒ %s", (s, stage, since, detail) => {
    const f = postingToFacts(postingRow({ ...signed, lots: [lot({ state: lotState(), sales: [s] })] }), NOW)!;
    expect(f.round?.price).toBe(6_100_000_000);
    expect(resolvePipelineStage(f)).toEqual({ stage, since, detail });
  });

  it("lot marked paid ⇒ Đã thu tiền from the confirmation", () => {
    const st = lotState({ payment_status: "paid", payment_confirmed_at: at(9, 23) });
    expect(stageOf(postingRow({ ...signed, lots: [lot({ state: st })] }))).toMatchObject({
      stage: "da_thu_tien",
      since: at(9, 23),
    });
  });

  it("buyer refused ⇒ defaulted ⇒ Không thành; seller refused ⇒ back to Trúng", () => {
    const refused = sale({ status: "cancelled", cancelled_at: at(9, 23), cancel_kind: "buyer_refused" });
    const defaulted = lotState({ payment_status: "defaulted" });
    expect(stageOf(postingRow({ ...signed, lots: [lot({ state: defaulted, sales: [refused] })] }))).toMatchObject({
      stage: "khong_thanh",
      detail: "Người trúng bỏ cọc",
    });

    const sellerOut = sale({ status: "cancelled", cancelled_at: at(9, 23), cancel_kind: "seller_refused" });
    expect(stageOf(postingRow({ ...signed, lots: [lot({ state: lotState(), sales: [sellerOut] })] }))).toEqual({
      stage: "trung",
      since: at(9, 23),
      detail: "HĐ mua bán đã huỷ",
    });
  });
});

describe("postingToFacts — nhiều phiên (đấu lại)", () => {
  const failed = lot({
    id: "old",
    created_at: at(8, 1),
    session: session({ code: "PDG000009", published_at: at(8, 1), starts_at: at(8, 20), ends_at: at(8, 20, 11) }),
    state: lotState({ result: "unsold", closed_at: at(8, 20, 11) }),
  });

  it("older unsold + newer announced ⇒ Chờ đấu lại from the failed round", () => {
    const row = postingRow({ ...signed, lots: [failed, lot({ id: "new", session: session({ published_at: at(9, 20) }) })] });
    expect(postingToFacts(row, NOW)?.prior).toEqual({ at: at(8, 20, 11) });
    expect(stageOf(row)).toEqual({ stage: "cho_dau_lai", since: at(8, 20, 11), detail: "Lịch đấu lại 05/10" });
  });

  it("older unsold + newer session under way ⇒ Phiên", () => {
    const live = session({ published_at: at(9, 10), starts_at: at(9, 26, 14), ends_at: at(9, 26, 18), registration_end_at: at(9, 24) });
    expect(stageOf(postingRow({ ...signed, lots: [lot({ id: "new", session: live }), failed] })).stage).toBe("phien");
  });

  it("older unsold + newer session still a draft ⇒ Không thành", () => {
    const row = postingRow({ ...signed, lots: [failed, lot({ id: "new", session: session({ status: "draft", published_at: null }) })] });
    expect(stageOf(row).stage).toBe("khong_thanh");
  });

  it("orders by publication, not by auction day", () => {
    const cancelledLate = lot({
      id: "cancelled",
      session: session({ status: "cancelled", published_at: at(9, 1), starts_at: at(10, 20), ends_at: at(10, 20, 11), updated_at: at(9, 12) }),
    });
    const replacement = lot({ id: "replacement", session: session({ published_at: at(9, 14) }) });
    const f = postingToFacts(postingRow({ ...signed, lots: [cancelledLate, replacement] }), NOW)!;
    expect(f.round).toMatchObject({ state: "announced" });
    expect(f.prior).toEqual({ at: at(9, 12) });
  });
});

// ─── Tin đã nhận ─────────────────────────────────────────────────────────────

const claim = (over: Partial<AssetOwnerClaim> = {}, ca: Record<string, unknown> = {}): AssetOwnerClaim => ({
  id: "c1",
  workspace_id: "ws1",
  listing_id: "l1",
  asset_owner_id: "ao1",
  confidence_score: 0.9,
  match_basis: null,
  matched_name: "CN Q.7",
  status: "confirmed",
  confirmed_by: null,
  confirmed_at: null,
  rejection_reason: null,
  created_at: at(8, 1),
  updated_at: at(8, 1),
  listing: {
    title: "Căn hộ Thủ Đức",
    price: 3_000_000_000,
    property_type_slug: "can-ho",
    image_url: null,
    status: "ACTIVE",
    address: null,
    custom_attributes: ca,
    created_at: at(9, 10),
  },
  ...over,
});

const outcome = (over: Partial<ResolvedAssetOutcome> = {}): ResolvedAssetOutcome => ({
  listingId: "l1",
  outcome: "sold",
  price: 3_400_000_000,
  date: "2026-09-20",
  paymentStatus: "pending",
  confidence: "self_reported",
  hasConflict: false,
  sources: [
    {
      kind: "owner_report",
      label: "self_reported",
      outcome: "sold",
      price: 3_400_000_000,
      date: "2026-09-20",
      orgName: null,
      sessionCode: null,
      roundNo: 1,
      refId: "o1",
      paymentStatus: "pending",
    },
  ],
  ...over,
});

const platformSold = (contractStatus: string | null, paymentStatus: ResolvedAssetOutcome["paymentStatus"] = "pending") =>
  outcome({
    paymentStatus,
    confidence: "platform",
    sources: [
      {
        kind: "platform",
        label: "platform",
        outcome: "sold",
        price: 3_400_000_000,
        date: "2026-09-20",
        orgName: "Công ty X",
        sessionCode: "PDG000013",
        roundNo: null,
        refId: "lot1",
        paymentStatus,
        contractCode: contractStatus ? "HDMB0001" : null,
        contractStatus: contractStatus as never,
      },
    ],
  });

const claimStage = (c: AssetOwnerClaim, o?: ResolvedAssetOutcome) => resolvePipelineStage(claimToFacts(c, o, NOW)!);

describe("claimToFacts — không lên bảng", () => {
  it.each([
    ["pending confirmation", claim({ status: "pending_confirmation" })],
    ["rejected", claim({ status: "rejected" })],
    ["listing hidden by RLS", claim({ listing: undefined })],
    ["no listing id", claim({ listing_id: null })],
  ])("%s ⇒ null", (_label, c) => {
    expect(claimToFacts(c, undefined, NOW)).toBeNull();
  });
});

describe("claimToFacts — chưa có kết quả", () => {
  it("future auction still taking registrations ⇒ Niêm yết from the listing's creation", () => {
    const c = claim({}, { auction_time: "2026-10-05", registration_deadline: "2026-10-01" });
    expect(claimToFacts(c, undefined, NOW)).toMatchObject({ kind: "listing", href: "/listings/l1", startingPrice: 3_000_000_000 });
    expect(claimStage(c)).toEqual({ stage: "niem_yet", since: at(9, 10), detail: "Đang bán hồ sơ · 05/10" });
  });

  it("falls back to the claim date when the listing has no creation date", () => {
    const c = claim({}, { auction_date: "2026-10-05" });
    c.listing!.created_at = null;
    expect(claimStage(c).since).toBe(at(8, 1));
  });

  it("no dates at all ⇒ Niêm yết without a day", () => {
    expect(claimStage(claim())).toEqual({ stage: "niem_yet", since: at(9, 10), detail: "Đang bán hồ sơ" });
  });

  it("auction started within the last two hours ⇒ Phiên · Đang diễn ra", () => {
    expect(claimStage(claim({}, { auction_time: at(9, 26, 14) }))).toEqual({
      stage: "phien",
      since: at(9, 26, 14),
      detail: "Đang diễn ra",
    });
  });

  it("auction passed without any source ⇒ Phiên · Chờ kết quả", () => {
    expect(claimStage(claim({}, { auction_time: "2026-09-20" }))).toEqual({
      stage: "phien",
      since: "2026-09-20",
      detail: "Chờ kết quả",
    });
  });
});

describe("claimToFacts — kết quả lượt hiện tại", () => {
  const passed = { auction_time: "2026-09-20" };

  it.each([
    [outcome(), "trung", "Chờ thu tiền"],
    [outcome({ paymentStatus: null }), "trung", "Chưa rõ thanh toán"],
    [outcome({ paymentStatus: "partial" }), "hd_mua_ban", "Đã thu một phần"],
    [outcome({ paymentStatus: "paid" }), "da_thu_tien", null],
    [outcome({ paymentStatus: "defaulted" }), "khong_thanh", "Người trúng bỏ cọc"],
    [platformSold("drafting"), "hd_mua_ban", "Đang ký hợp đồng"],
    [platformSold("signed"), "hd_mua_ban", "Đang thanh toán"],
    [platformSold("completed"), "da_thu_tien", null],
    [platformSold("cancelled"), "trung", "Chờ thu tiền"],
    [platformSold(null), "trung", "Chờ thu tiền"],
  ])("sold %# ⇒ %s", (o, stage, detail) => {
    expect(claimStage(claim({}, passed), o)).toMatchObject({ stage, detail });
  });

  it("carries the winning price onto the card", () => {
    expect(claimToFacts(claim({}, passed), outcome(), NOW)?.round?.price).toBe(3_400_000_000);
  });

  it("unsold ⇒ Không thành; postponed ⇒ Chờ đấu lại", () => {
    expect(claimStage(claim({}, passed), outcome({ outcome: "unsold", price: null }))).toMatchObject({
      stage: "khong_thanh",
      since: "2026-09-20",
    });
    expect(claimStage(claim({}, passed), outcome({ outcome: "postponed", price: null }))).toMatchObject({
      stage: "cho_dau_lai",
      detail: "Hoãn",
    });
  });

  it("an outcome without a date counts as the current round", () => {
    expect(claimStage(claim({}, { auction_time: "2026-10-05" }), outcome({ outcome: "unsold", date: null })).stage).toBe(
      "khong_thanh",
    );
  });
});

describe("claimToFacts — kết quả của lượt trước (SAME_ROUND_DAYS)", () => {
  it("older unsold + new auction announced ⇒ Chờ đấu lại from the old result", () => {
    const c = claim({}, { auction_time: "2026-10-05" });
    const f = claimToFacts(c, outcome({ outcome: "unsold", date: "2026-08-01" }), NOW)!;
    expect(f.prior).toEqual({ at: "2026-08-01" });
    expect(resolvePipelineStage(f)).toEqual({
      stage: "cho_dau_lai",
      since: "2026-08-01",
      detail: "Lịch đấu lại 05/10",
    });
  });

  it("older result + new auction already passed ⇒ Phiên · Chờ kết quả", () => {
    expect(claimStage(claim({}, { auction_time: "2026-09-20" }), outcome({ outcome: "unsold", date: "2026-08-01" }))).toMatchObject({
      stage: "phien",
      detail: "Chờ kết quả",
    });
  });

  it("7 days apart is the same round, 8 days is an older one", () => {
    const c = claim({}, { auction_time: "2026-09-20" });
    expect(claimStage(c, outcome({ outcome: "unsold", date: "2026-09-13" })).stage).toBe("khong_thanh");
    expect(claimStage(c, outcome({ outcome: "unsold", date: "2026-09-12" })).stage).toBe("phien");
  });
});

describe("collectPipelineFacts", () => {
  it("combines claims and postings, counting unconfirmed claims separately", () => {
    const claims = [
      claim({ id: "a", listing_id: "l1" }, { auction_time: "2026-10-05" }),
      claim({ id: "b", listing_id: "l2" }, { auction_time: "2026-09-20" }),
      claim({ id: "c", listing_id: "l3", status: "pending_confirmation" }),
      claim({ id: "d", listing_id: "l4", status: "pending_confirmation", listing: undefined }),
      claim({ id: "e", listing_id: "l5", status: "rejected" }),
    ];
    const postings = [postingRow({ id: "p1" }), postingRow({ id: "p2", status: "cancelled" })];
    const { facts, pendingClaimCount } = collectPipelineFacts({
      claims,
      outcomesByListing: { l2: outcome({ listingId: "l2" }) },
      postings,
      now: NOW,
    });
    expect(facts.map((f) => f.id)).toEqual(["l1", "l2", "p1"]);
    expect(pendingClaimCount).toBe(1);

    const board = groupPipeline(facts, NOW);
    const placed = board.columns.flatMap((c) => c.cards.map((x) => `${x.id}:${x.stage}`));
    expect(placed.sort()).toEqual(["l1:niem_yet", "l2:trung", "p1:so_hoa"]);
  });
});

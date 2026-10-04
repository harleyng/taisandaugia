import { describe, expect, it } from "vitest";
import {
  STAGE_PHASE,
  buildOwnerAssets,
  matchesAssetFilter,
  type BuildOwnerAssetsInput,
} from "./ownerAssets";
import { PIPELINE_STAGES } from "./ownerPipeline";
import type { PipelineLotRow, PipelinePostingRow } from "./ownerPipelineFacts";
import type { ResolvedAssetOutcome } from "./ownerOutcomes";
import type { OwnerConsignmentSummaryRow } from "./consignment/postingBadge";
import type { AssetOwnerClaim } from "@/types/asset-owner";

// 26/09/2026 15:00 giờ máy.
const NOW = new Date(2026, 8, 26, 15, 0, 0);
const at = (m: number, d: number, h = 9) => new Date(2026, m - 1, d, h).toISOString();

const claim = (over: Partial<AssetOwnerClaim> = {}, ca: Record<string, unknown> = {}): AssetOwnerClaim => ({
  id: "c1",
  workspace_id: "ws1",
  listing_id: "3f9a12bc-0000-0000-0000-000000000001",
  asset_owner_id: "ao1",
  confidence_score: 0.96,
  match_basis: null,
  matched_name: "Ngân hàng An Phát – CN Sài Gòn",
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
    address: { province: "TP.HCM" },
    custom_attributes: ca,
    created_at: at(9, 10),
  },
  ...over,
});

const soldOutcome = (over: Partial<ResolvedAssetOutcome> = {}): ResolvedAssetOutcome => ({
  listingId: "3f9a12bc-0000-0000-0000-000000000001",
  outcome: "sold",
  price: 3_400_000_000,
  date: "2026-09-20",
  paymentStatus: "pending",
  confidence: "self_reported",
  hasConflict: false,
  sources: [],
  ...over,
});

const posting = (over: Partial<PipelinePostingRow> = {}): PipelinePostingRow => ({
  id: "p1",
  title: "Nhà xưởng KCN Quế Võ",
  status: "active",
  review_status: "approved",
  starting_price: null,
  chosen_org_id: null,
  created_at: at(9, 20),
  updated_at: at(9, 20),
  user_id: "u1",
  workspace_id: "ws1",
  branch_id: "br-hn",
  province: "Bắc Ninh",
  child_slug: null,
  chosen_org: null,
  requests: [],
  brokers: [],
  contracts: [],
  lots: [],
  ...over,
});

const input = (over: Partial<BuildOwnerAssetsInput> = {}): BuildOwnerAssetsInput => ({
  claims: [],
  outcomesByListing: {},
  postings: [],
  roundCountsByListing: {},
  branchNameById: { "br-hn": "CN Hà Nội" },
  branchNameByOwner: { ao1: "CN Sài Gòn" },
  consignmentByPosting: {},
  canWriteClaim: () => true,
  canWritePosting: () => true,
  now: NOW,
  ...over,
});

// Phiên 22/09 đã qua, chưa có kết quả ⇒ "Phiên · Chờ kết quả".
const PAST_AUCTION = { auction_time: at(9, 22) };

describe("STAGE_PHASE", () => {
  it("mọi giai đoạn của Đường ống thuộc đúng một nhóm tab", () => {
    for (const s of PIPELINE_STAGES) expect(STAGE_PHASE[s]).toBeDefined();
  });
});

describe("buildOwnerAssets — tin đã nhận", () => {
  it("gắn khu vực, chi nhánh theo asset_owner, mã và số vòng", () => {
    const c = claim({}, PAST_AUCTION);
    const { rows } = buildOwnerAssets(input({ claims: [c], roundCountsByListing: { [c.listing_id!]: 2 } }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      province: "TP.HCM",
      branch: "CN Sài Gòn",
      code: "3F9A12BC",
      rounds: 2,
      stage: "phien",
      phase: "auc",
      stepLabel: "Phiên đấu giá",
    });
  });

  it("chi nhánh rơi về matched_name khi asset_owner chưa gắn chi nhánh", () => {
    const { rows } = buildOwnerAssets(input({ claims: [claim({ asset_owner_id: "khac" }, PAST_AUCTION)] }));
    expect(rows[0].branch).toBe("Ngân hàng An Phát – CN Sài Gòn");
  });

  it("phiên đã qua chưa có kết quả ⇒ việc của bạn: Khai kết quả", () => {
    const { rows } = buildOwnerAssets(input({ claims: [claim({}, PAST_AUCTION)] }));
    expect(rows[0].next).toMatchObject({ mine: true, cta: { label: "Khai kết quả", action: { kind: "report_outcome" } } });
  });

  it("không có quyền ghi ⇒ không nợ việc, không có nút", () => {
    const { rows } = buildOwnerAssets(input({ claims: [claim({}, PAST_AUCTION)], canWriteClaim: () => false }));
    expect(rows[0].next).toMatchObject({ mine: false, cta: null, waitingOn: "Thành viên phụ trách" });
  });

  it("trúng đấu giá ⇒ giá trúng + Ghi thu ở Dòng tiền", () => {
    const c = claim({}, { auction_time: at(9, 20) });
    const { rows } = buildOwnerAssets(input({ claims: [c], outcomesByListing: { [c.listing_id!]: soldOutcome() } }));
    expect(rows[0]).toMatchObject({ stage: "trung", phase: "won", price: 3_400_000_000, priceKind: "winning" });
    expect(rows[0].next.cta).toEqual({ label: "Ghi thu", action: { kind: "navigate", href: "/chu-tai-san/dong-tien" } });
  });

  it("không thành ⇒ việc của bạn nhưng chưa có nút", () => {
    const c = claim({}, { auction_time: at(9, 20) });
    const { rows } = buildOwnerAssets(
      input({ claims: [c], outcomesByListing: { [c.listing_id!]: soldOutcome({ outcome: "unsold", price: null }) } }),
    );
    expect(rows[0]).toMatchObject({ stage: "khong_thanh", phase: "fail" });
    expect(rows[0].next).toMatchObject({ mine: true, cta: null });
  });

  it("tin đang đấu giá / không thành có lối 'Đẩy truyền thông'; đã trúng thì không", () => {
    const href = "/chu-tai-san/truyen-thong?tab=giao-viec&dat=3f9a12bc-0000-0000-0000-000000000001";
    const auc = buildOwnerAssets(input({ claims: [claim({}, { auction_time: at(10, 20) })] })).rows[0];
    expect(auc.phase).toBe("auc");
    expect(auc.links).toContainEqual({ label: "Đẩy truyền thông", href });

    const c = claim({}, { auction_time: at(9, 20) });
    const won = buildOwnerAssets(input({ claims: [c], outcomesByListing: { [c.listing_id!]: soldOutcome() } })).rows[0];
    expect(won.links.some((l) => l.label === "Đẩy truyền thông")).toBe(false);
    // Phễu riêng của tài sản luôn có, kể cả đã bán (Phase M5).
    expect(won.links).toContainEqual({
      label: "Hiệu quả truyền thông",
      href: `/chu-tai-san/hieu-qua-quang-cao?tai-san=${won.claim!.listing_id}`,
    });
  });

  it("tin chờ xác nhận vào 'Sàn tìm thấy', không vào bảng", () => {
    const c = claim({ status: "pending_confirmation", confidence_score: 0.72 }, { auction_date: "2026-10-15" });
    const { rows, claimRows } = buildOwnerAssets(input({ claims: [c] }));
    expect(rows).toHaveLength(0);
    expect(claimRows).toEqual([
      expect.objectContaining({ id: "c1", score: 72, province: "TP.HCM", branch: "CN Sài Gòn", auctionDay: "2026-10-15", canWrite: true }),
    ]);
  });

  it("tin bị từ chối không hiện ở đâu cả", () => {
    const out = buildOwnerAssets(input({ claims: [claim({ status: "rejected" })] }));
    expect(out.rows).toHaveLength(0);
    expect(out.claimRows).toHaveLength(0);
  });
});

describe("buildOwnerAssets — hồ sơ số hoá", () => {
  it("bản nháp ⇒ Tiếp tục ở trang hồ sơ; chi nhánh theo branch_id", () => {
    const { rows } = buildOwnerAssets(input({ postings: [posting({ status: "draft" })] }));
    expect(rows[0]).toMatchObject({ stage: "so_hoa", phase: "prep", branch: "CN Hà Nội", province: "Bắc Ninh", code: null });
    expect(rows[0].next.cta).toEqual({ label: "Tiếp tục", action: { kind: "navigate", href: "/chu-tai-san/dang-tai-san/p1" } });
  });

  it("đang chờ sàn duyệt ⇒ đang chờ Sàn", () => {
    const { rows } = buildOwnerAssets(input({ postings: [posting({ review_status: "pending" })] }));
    expect(rows[0].next).toMatchObject({ mine: false, waitingOn: "Sàn" });
  });

  it("RPC ký gửi báo có báo giá chờ chọn ⇒ So sánh", () => {
    const row = posting({
      requests: [{ status: "quoted", created_at: at(9, 21), updated_at: at(9, 22), reopened_at: null }],
    });
    const consignment: OwnerConsignmentSummaryRow = {
      posting_id: "p1",
      quoted_count: 2,
      has_selection: false,
      contract_id: null,
      contract_status: null,
      owner_action: "choose_quote",
    };
    const { rows } = buildOwnerAssets(input({ postings: [row], consignmentByPosting: { p1: consignment } }));
    expect(rows[0].stage).toBe("chon_to_chuc");
    expect(rows[0].next).toMatchObject({ mine: true, cta: { label: "So sánh" } });
  });

  it("phiên trên sàn chờ kết quả ⇒ chờ tổ chức (chủ tài sản không tự khai)", () => {
    const lot: PipelineLotRow = {
      id: "lot1",
      created_at: at(9, 10),
      session: {
        status: "published",
        code: "PDG000131",
        starts_at: at(9, 22),
        ends_at: at(9, 22, 11),
        registration_end_at: at(9, 18),
        published_at: at(9, 12),
        updated_at: at(9, 12),
      },
      state: null,
      sales: [],
    };
    const { rows } = buildOwnerAssets(
      input({ postings: [posting({ lots: [lot], chosen_org: { name: "Công ty ĐGHD Lạc Việt" } })] }),
    );
    expect(rows[0]).toMatchObject({ stage: "phien", rounds: 1, orgName: "Công ty ĐGHD Lạc Việt" });
    expect(rows[0].next).toMatchObject({ mine: false, waitingOn: "Tổ chức" });
  });
});

describe("buildOwnerAssets — thứ tự", () => {
  it("việc của bạn lên đầu", () => {
    const waitingReview = posting({ id: "p-wait", title: "A — chờ duyệt", review_status: "pending" });
    const draft = posting({ id: "p-draft", title: "Z — bản nháp", status: "draft" });
    const { rows } = buildOwnerAssets(input({ postings: [waitingReview, draft] }));
    expect(rows.map((r) => r.id)).toEqual(["p-draft", "p-wait"]);
  });
});

describe("matchesAssetFilter", () => {
  const row = { title: "Nhà phố Lê Văn Sỹ", province: "TP.HCM", branch: "CN Sài Gòn", category: "Nhà phố", code: "8F2A1C00" };
  const f = (over = {}) => ({ query: "", branch: "", category: "", ...over });

  it("tìm theo tên, khu vực, chi nhánh", () => {
    expect(matchesAssetFilter(row, f({ query: "lê văn" }))).toBe(true);
    expect(matchesAssetFilter(row, f({ query: "tp.hcm" }))).toBe(true);
    expect(matchesAssetFilter(row, f({ query: "sài gòn" }))).toBe(true);
    expect(matchesAssetFilter(row, f({ query: "hà nội" }))).toBe(false);
  });

  it("tìm theo mã, có hoặc không tiền tố", () => {
    expect(matchesAssetFilter(row, f({ query: "8f2a" }))).toBe(true);
    expect(matchesAssetFilter(row, f({ query: "TS-8F2A1C" }))).toBe(true);
    expect(matchesAssetFilter(row, f({ query: "Mã 8F2A" }))).toBe(true);
    expect(matchesAssetFilter(row, f({ query: "8f2" }))).toBe(false);
  });

  it("lọc chi nhánh và loại", () => {
    expect(matchesAssetFilter(row, f({ branch: "CN Hà Nội" }))).toBe(false);
    expect(matchesAssetFilter(row, f({ category: "Nhà phố", branch: "CN Sài Gòn" }))).toBe(true);
  });
});

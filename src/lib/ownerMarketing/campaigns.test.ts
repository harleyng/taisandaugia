import { describe, expect, it } from "vitest";
import {
  BRANCH_FILTER_ALL,
  CampaignRpcError,
  campaignErrorMessage,
  campaignTabCounts,
  draftsPayload,
  editorProgress,
  EMPTY_DRAFTS,
  filterCampaigns,
  isSelfReview,
  mapCampaignRow,
  parseDrafts,
  parseFacts,
  unwrapRpc,
  type CampaignDbRow,
} from "./campaigns";

const ASSET: Record<string, unknown> = {
  listing_id: "l1",
  title: "Kho bãi 84.4m² tại Trung tâm, Quảng Ninh",
  category_slug: "kho-xuong",
  province: "Quảng Ninh",
  district: "Trung tâm",
  area: "84.40",
  announced: true,
  source: "notice",
  starting_price: "36054723587.00",
  deposit: null,
  auction_at: "2026-10-22T02:00:00+00:00",
  registration_end_at: "2026-10-17T10:00:00+00:00",
  org_name: "Công ty Đấu giá Hợp danh Đông Dương",
};

const dbRow = (over: Partial<CampaignDbRow> = {}): CampaignDbRow => ({
  id: "c1",
  workspace_id: "w1",
  name: "Đẩy kho bãi Quảng Ninh",
  notes: null,
  listing_ids: ["l1"],
  channels: ["sms", "zalo", "tiktok"],
  status: "pending_approval",
  facts_snapshot: { built_at: "2026-10-01T00:00:00Z", assets: [ASSET] },
  drafts: { zalo: { body: "Mô tả" } },
  branch_id: "b1",
  sent_channels: { zalo: "2026-10-02T00:00:00Z", bogus: "x" },
  created_by: "u1",
  submitted_by: "u1",
  submitted_at: null,
  approved_by: null,
  approved_at: null,
  rejected_by: null,
  rejected_at: null,
  rejected_reason: null,
  sent_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  branch: { display_name: "CN Quảng Ninh" },
  ...over,
});

describe("parseFacts", () => {
  it("ép số từ chuỗi numeric của Postgres, giữ null", () => {
    const f = parseFacts({ built_at: "x", assets: [ASSET] });
    expect(f.assets[0].starting_price).toBe(36054723587);
    expect(f.assets[0].area).toBe(84.4);
    expect(f.assets[0].deposit).toBeNull();
    expect(f.assets[0].bid_step).toBeNull();
  });

  it("bỏ tài sản hỏng, không ném lỗi", () => {
    expect(parseFacts({ assets: [{ title: "thiếu id" }, ASSET, 3] }).assets).toHaveLength(1);
    expect(parseFacts(null).assets).toEqual([]);
  });
});

describe("drafts", () => {
  it("parse thiếu khoá ⇒ chuỗi rỗng", () => {
    expect(parseDrafts({ zalo: { body: "x" } })).toEqual({ ...EMPTY_DRAFTS, zalo: { body: "x" } });
  });

  it("payload chỉ gồm kênh đã chọn và đúng khoá server nhận", () => {
    const d = { ...EMPTY_DRAFTS, email: { subject: "S", body: "B" }, zalo: { body: "Z" } };
    expect(draftsPayload(d, ["email", "zalo"])).toEqual({ email: { subject: "S", body: "B" }, zalo: { body: "Z" } });
  });
});

describe("mapCampaignRow", () => {
  it("lọc kênh lạ, kênh đã gửi lạ; lấy tên chi nhánh", () => {
    const r = mapCampaignRow(dbRow());
    expect(r.channels).toEqual(["zalo", "sms"]);
    expect(r.sentChannels).toEqual({ zalo: "2026-10-02T00:00:00Z" });
    expect(r.branchName).toBe("CN Quảng Ninh");
    expect(r.status).toBe("pending_approval");
  });
});

describe("danh sách", () => {
  const rows = [
    mapCampaignRow(dbRow()),
    mapCampaignRow(dbRow({ id: "c2", status: "rejected", name: "Căn hộ Đống Đa", branch_id: "b2" })),
    mapCampaignRow(dbRow({ id: "c3", status: "sent", name: "Nhà phố" })),
  ];

  it("đếm theo tab — bị từ chối nằm ở Nháp (cần sửa lại)", () => {
    expect(campaignTabCounts(rows)).toEqual({ "tat-ca": 3, nhap: 1, "cho-duyet": 1, "da-duyet": 0, "da-gui": 1 });
  });

  it("lọc tab + chi nhánh + tìm không dấu theo tên hoặc tài sản", () => {
    expect(filterCampaigns(rows, "nhap", "", BRANCH_FILTER_ALL).map((r) => r.id)).toEqual(["c2"]);
    expect(filterCampaigns(rows, "tat-ca", "", "b2").map((r) => r.id)).toEqual(["c2"]);
    expect(filterCampaigns(rows, "tat-ca", "dong da", BRANCH_FILTER_ALL).map((r) => r.id)).toEqual(["c2"]);
    expect(filterCampaigns(rows, "tat-ca", "quang ninh", BRANCH_FILTER_ALL)).toHaveLength(3);
  });
});

describe("editorProgress", () => {
  it("Nội dung xong khi MỌI kênh đã chọn có mô tả (Email cần tiêu đề)", () => {
    const base = { name: "Tên ok", assetKeys: ["listing:l1"], channels: ["email", "sms"] as const, drafts: EMPTY_DRAFTS };
    expect(editorProgress({ ...base, channels: [...base.channels] }).done.content).toBe(false);
    const drafts = { ...EMPTY_DRAFTS, email: { subject: "", body: "B" }, sms: { body: "x" } };
    expect(editorProgress({ ...base, channels: [...base.channels], drafts }).done.content).toBe(false);
    const full = { ...drafts, email: { subject: "S", body: "B" } };
    const p = editorProgress({ ...base, channels: [...base.channels], drafts: full });
    expect(p.done).toEqual({ info: true, assets: true, channels: true, content: true });
    expect(p.progress).toBe(1);
  });
});

describe("duyệt hai người", () => {
  it("người soạn / gửi duyệt không tự duyệt, trừ Trạm 1 thành viên", () => {
    const c = { createdBy: "u1", submittedBy: "u2" };
    expect(isSelfReview(c, "u1", 3)).toBe(true);
    expect(isSelfReview(c, "u2", 3)).toBe(true);
    expect(isSelfReview(c, "u3", 3)).toBe(false);
    expect(isSelfReview(c, "u1", 1)).toBe(false);
  });
});

describe("lỗi RPC", () => {
  it("ok:false ⇒ CampaignRpcError có câu tiếng Việt", () => {
    expect(() => unwrapRpc({ ok: false, reason: "self_approval" })).toThrow(CampaignRpcError);
    expect(unwrapRpc<{ ok: true; id: string }>({ ok: true, id: "x" }).id).toBe("x");
    expect(campaignErrorMessage(new CampaignRpcError("self_approval"))).toMatch(/không tự duyệt/);
    expect(campaignErrorMessage(new CampaignRpcError("drafts_invalid"))).toMatch(/không sửa được/);
    expect(campaignErrorMessage(new CampaignRpcError("??"))).toBe("Thao tác không thành công.");
  });
});

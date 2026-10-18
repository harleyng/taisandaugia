import { describe, expect, it } from "vitest";
import type { ContractWithSession } from "@/types/bidding-contract";
import {
  contractDocuments,
  contractHistory,
  contractsCsv,
  depositFilterOptions,
  filterTabContracts,
  headerActionsOf,
  refundActionOf,
  rowActionOf,
} from "./contractDetail";

const session = {
  id: "s1",
  code: "PDG000001",
  title: "Phiên",
  starts_at: "2026-10-20T02:00:00Z",
  ends_at: "2026-10-20T04:00:00Z",
  status: "published",
  auction_format: "truc_tiep",
  finalized_at: null,
  venue: null,
  checkin_lead_minutes: 60,
  checkin_grace_minutes: 15,
  roster_closed_at: null,
} as ContractWithSession["auction_sessions"];

function make(p: Partial<ContractWithSession> = {}): ContractWithSession {
  return {
    id: "c1",
    code: "HSDG000001",
    session_id: "s1",
    status: "paid",
    review_status: "pending",
    deposit_status: "pending",
    buyer_kind: "individual",
    full_name: "Nguyễn Văn An",
    org_name: null,
    phone: "0901234567",
    email: "an@example.com",
    id_type: "cccd",
    id_number: "079123456789",
    id_front_path: "u/front.jpg",
    id_back_path: "u/back.png",
    id_edited_fields: [],
    has_proxy: false,
    proxy_id_edited_fields: [],
    paid_at: "2026-10-08T03:00:00Z",
    fee_amount: 200000,
    checked_in_at: null,
    absent_at: null,
    bidder_no: null,
    refunded_at: null,
    deposit_amount_received: null,
    auction_sessions: session,
    ...p,
  } as ContractWithSession;
}

describe("headerActionsOf", () => {
  it("chờ duyệt ⇒ đủ 3 nút theo thứ tự design", () => {
    expect(headerActionsOf(make()).decisions).toEqual(["rejected", "needs_info", "approved"]);
  });

  it("cần bổ sung ⇒ chỉ những nút server cho phép (không yêu cầu bổ sung lần nữa)", () => {
    expect(headerActionsOf(make({ review_status: "needs_info" })).decisions).toEqual(["rejected", "approved"]);
  });

  it("đã duyệt ⇒ không nút (design), dòng trạng thái nhắc tiền đặt trước", () => {
    const r = headerActionsOf(make({ review_status: "approved" }));
    expect(r.decisions).toEqual([]);
    expect(r.statusLine).toBe("Đã duyệt — đủ điều kiện điểm danh khi nộp đủ tiền đặt trước");
    expect(headerActionsOf(make({ review_status: "approved", deposit_status: "received" })).statusLine).toBe(
      "Đã duyệt — đủ điều kiện điểm danh",
    );
  });

  it("đã từ chối / phiên huỷ", () => {
    expect(headerActionsOf(make({ status: "refunded", review_status: "rejected" })).statusLine).toBe("Hồ sơ đã bị từ chối");
    const cx = make({ auction_sessions: { ...session!, status: "cancelled" } });
    expect(headerActionsOf(cx)).toEqual({ decisions: [], statusLine: "Phiên đã huỷ" });
  });
});

describe("rowActionOf", () => {
  it("chờ duyệt ⇒ xem & duyệt; đã duyệt chưa nộp ⇒ ghi nhận; còn lại xem", () => {
    expect(rowActionOf(make(), false)).toBe("review");
    expect(rowActionOf(make({ review_status: "approved" }), false)).toBe("deposit");
    expect(rowActionOf(make({ review_status: "approved", deposit_status: "received" }), false)).toBe("view");
    expect(rowActionOf(make(), true)).toBe("view");
  });
});

describe("filterTabContracts", () => {
  const rows = [
    make({ id: "a", code: "HSDG1", review_status: "approved", deposit_status: "received" }),
    make({ id: "b", code: "HSDG2", full_name: "Trần Thị Bích" }),
    make({ id: "c", code: "HSDG3", review_status: "rejected", deposit_status: "refunded" }),
  ];

  it("Tất cả đẩy chờ duyệt lên đầu, giữ thứ tự còn lại", () => {
    expect(filterTabContracts(rows, "all", "all", "").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("lọc trạng thái, đặt trước và tìm bỏ dấu", () => {
    expect(filterTabContracts(rows, "approved", "all", "").map((r) => r.id)).toEqual(["a"]);
    expect(filterTabContracts(rows, "all", "refunded", "").map((r) => r.id)).toEqual(["c"]);
    expect(filterTabContracts(rows, "all", "all", "tran thi").map((r) => r.id)).toEqual(["b"]);
  });

  it("lọc đặt trước: 3 lựa chọn design + trạng thái sau chốt chỉ khi có", () => {
    expect(depositFilterOptions(rows).map(([k]) => k)).toEqual(["all", "received", "pending", "refunded"]);
    const withForfeit = [...rows, make({ deposit_status: "forfeited" })];
    expect(depositFilterOptions(withForfeit).map(([k]) => k)).toContain("forfeited");
  });
});

describe("contractDocuments", () => {
  it("cá nhân CCCD: 2 mặt, cờ trường đã sửa ở mặt trước", () => {
    const docs = contractDocuments(make({ id_edited_fields: ["full_name"] }));
    expect(docs.map((d) => d.label)).toEqual(["CCCD mặt trước", "CCCD mặt sau"]);
    expect(docs[0].flag).toBe("Đã sửa so với máy đọc: Họ tên");
    expect(docs[1].meta).toBe("PNG");
  });

  it("tổ chức + uỷ quyền: ĐKDN, CCCD người đại diện, người được uỷ quyền, giấy uỷ quyền", () => {
    const docs = contractDocuments(
      make({
        buyer_kind: "organization",
        org_reg_doc_path: "u/dkdn.pdf",
        has_proxy: true,
        proxy_id_type: "cccd",
        proxy_id_front_path: "u/pf.jpg",
        proxy_id_back_path: null,
        poa_doc_path: "u/poa.pdf",
      }),
    );
    expect(docs.map((d) => d.key)).toEqual(["org_reg", "id_front", "id_back", "proxy_front", "poa"]);
    expect(docs[0].isImage).toBe(false);
  });
});

describe("refundActionOf", () => {
  it("chờ hoàn trả ⇒ mark; phiên huỷ đã nộp ⇒ set; còn lại không", () => {
    expect(refundActionOf(make({ deposit_status: "pending_refund" }))).toBe("mark");
    const cx = { ...session!, status: "cancelled" as const };
    expect(refundActionOf(make({ deposit_status: "received", auction_sessions: cx }))).toBe("set");
    expect(refundActionOf(make({ deposit_status: "received" }))).toBeNull();
  });
});

describe("contractHistory", () => {
  it("gộp và sắp mới nhất trước, bỏ sự kiện nộp hồ sơ trùng lúc thanh toán", () => {
    const h = contractHistory(
      make({ review_status: "needs_info" }),
      [
        { kind: "submitted", at: "2026-10-08T03:00:00Z", note: null },
        { kind: "needs_info", at: "2026-10-09T03:00:00Z", note: "Chụp lại CCCD" },
      ],
      [{ kind: "received", at: "2026-10-10T03:00:00Z", amount: 5000000, actor_id: "u1" }],
    );
    expect(h.map((e) => e.text)).toEqual([
      "Ghi nhận tiền đặt trước 5,000,000₫",
      "Yêu cầu bổ sung — Chụp lại CCCD",
      "Mua hồ sơ và thanh toán phí qua sàn · 200,000₫",
    ]);
  });
});

describe("contractsCsv", () => {
  it("có BOM và trích dẫn ô có dấu phẩy", () => {
    const csv = contractsCsv([make({ full_name: "An, Nguyễn" })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"An, Nguyễn"');
  });

  it("withSession thêm cột mã + tên phiên ngay sau mã hồ sơ", () => {
    const [head, line] = contractsCsv([make()], { withSession: true }).slice(1).split("\n");
    expect(head.startsWith("Mã hồ sơ,Mã phiên,Phiên,")).toBe(true);
    expect(line.startsWith("HSDG000001,PDG000001,Phiên,")).toBe(true);
  });
});

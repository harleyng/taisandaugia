import { describe, expect, it } from "vitest";
import { orgConsignmentActivity, orgConsignmentNextStep, orgConsignmentSummary } from "./orgConsignmentView";
import type { ConsignmentContract, ContractEvent } from "@/types/consignment-contract";

const contract = (over: Partial<ConsignmentContract> = {}): ConsignmentContract =>
  ({
    status: "drafting",
    terms: { commission_pct: 2, service_fee: 26_000_000, starting_price: null, lead_time_days: 45, plan: null, fee_items: null },
    signed_uploaded_side: null,
    signed_doc_path: null,
    owner_confirmed_at: null,
    org_confirmed_at: null,
    signed_at: null,
    signed_date: null,
    cancelled_at: null,
    cancelled_side: null,
    cancel_reason: null,
    contract_no: null,
    ...over,
  }) as unknown as ConsignmentContract;

describe("việc tiếp theo — góc nhìn tổ chức", () => {
  it("soạn dự thảo là việc của tổ chức; thiếu người đại diện thì phải khai trước", () => {
    expect(orgConsignmentNextStep(contract(), [])).toMatchObject({ headline: "Soạn dự thảo hợp đồng", mine: true });
    expect(orgConsignmentNextStep(contract(), ["org_legal_rep"]).headline).toBe("Khai người đại diện theo pháp luật");
    // Thiếu địa chỉ chủ tài sản: chờ bên kia, không phải việc của tổ chức.
    expect(orgConsignmentNextStep(contract(), ["owner_address"]).mine).toBe(false);
  });

  it("xác nhận bản ký: chưa xác nhận ⇒ việc của bạn, đã xác nhận ⇒ chờ chủ tài sản", () => {
    const c = contract({ status: "awaiting_confirmation", signed_doc_path: "x", signed_uploaded_side: "owner" });
    expect(orgConsignmentNextStep(c, [])).toMatchObject({ mine: true });
    expect(orgConsignmentNextStep(c, []).description).toContain("Chủ tài sản đã tải bản scan");
    const done = orgConsignmentNextStep({ ...c, org_confirmed_at: "2026-10-01T00:00:00Z" }, []);
    expect(done).toMatchObject({ mine: false, headline: "Chờ chủ tài sản xác nhận bản đã ký" });
  });

  it("đã huỷ nói rõ ai huỷ và lý do", () => {
    const c = contract({ status: "cancelled", cancelled_side: "owner", cancelled_at: "2026-10-05T00:00:00Z", cancel_reason: "Đổi ý" });
    expect(orgConsignmentNextStep(c, []).description).toBe("Chủ tài sản huỷ ngày 05/10/2026 · Lý do: Đổi ý");
  });
});

describe("tóm tắt & hoạt động", () => {
  it("Bên A là chủ tài sản; số hợp đồng chỉ hiện khi có", () => {
    const v = orgConsignmentSummary(contract({ contract_no: "12/HĐ" }), "Nguyễn Hoàng Long", 3_000_000_000);
    expect(v.rows[0]).toEqual({ label: "Bên A", value: "Nguyễn Hoàng Long" });
    expect(v.rows.some((r) => r.label === "Số hợp đồng")).toBe(true);
  });

  it("'Bạn' là tổ chức, mới nhất lên đầu", () => {
    const events: ContractEvent[] = [
      { action: "created", side: null, created_at: "2026-10-01T00:00:00Z", data: null },
      { action: "signed_uploaded", side: "owner", created_at: "2026-10-03T00:00:00Z", data: null },
      { action: "draft_shared", side: "org", created_at: "2026-10-02T00:00:00Z", data: null },
    ];
    expect(orgConsignmentActivity(events, null).map((a) => a.text)).toEqual([
      "Chủ tài sản tải bản đã ký",
      "Bạn chia sẻ dự thảo",
      "Chủ tài sản chọn báo giá của bạn — hợp đồng được tạo",
    ]);
  });
});

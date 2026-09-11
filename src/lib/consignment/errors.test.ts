import { describe, expect, it } from "vitest";
import {
  CONSIGNMENT_REASON_MESSAGES,
  ConsignmentRpcError,
  assertRpcOk,
  consignmentReasonMessage,
} from "./errors";

describe("assertRpcOk", () => {
  it("không ném khi RPC thành công hoặc trả dữ liệu không có cờ ok", () => {
    expect(() => assertRpcOk({ ok: true, opportunity_id: "x" })).not.toThrow();
    expect(() => assertRpcOk(null)).not.toThrow();
    expect(() => assertRpcOk(undefined)).not.toThrow();
    expect(() => assertRpcOk({ dispatched: 2 })).not.toThrow();
    expect(() => assertRpcOk([{ ok: false }])).not.toThrow();
  });

  it("ném ConsignmentRpcError mang reason + câu tiếng Việt khi ok=false", () => {
    try {
      assertRpcOk({ ok: false, reason: "already_selected" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConsignmentRpcError);
      expect((err as ConsignmentRpcError).reason).toBe("already_selected");
      expect((err as Error).message).toBe(CONSIGNMENT_REASON_MESSAGES.already_selected);
    }
  });

  it("party_incomplete nêu rõ thông tin còn thiếu từ payload", () => {
    try {
      assertRpcOk({ ok: false, reason: "party_incomplete", missing: ["owner_address", "org_legal_rep"] });
      expect.unreachable();
    } catch (err) {
      expect((err as ConsignmentRpcError).details.missing).toEqual(["owner_address", "org_legal_rep"]);
      expect((err as Error).message).toContain("địa chỉ của chủ tài sản");
      expect((err as Error).message).toContain("người đại diện theo pháp luật");
    }
  });

  it("reason lạ hoặc thiếu vẫn ra câu dự phòng, không lộ mã lỗi", () => {
    expect(() => assertRpcOk({ ok: false })).toThrow("Thao tác không thành công");
    expect(consignmentReasonMessage("something_new")).toBe("Thao tác không thành công. Vui lòng thử lại.");
  });
});

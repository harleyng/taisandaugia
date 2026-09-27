import { describe, expect, it } from "vitest";
import {
  ServiceContractError,
  providerPartyFromClauses,
  serviceCheckoutPath,
  serviceContractStageOf,
  serviceOrderOwnerPath,
  unwrapServiceContractRpc,
} from "./index";

describe("giai đoạn hợp đồng dịch vụ (suy từ trạng thái đơn)", () => {
  it("báo giá: chưa đồng ý ⇒ chờ đồng ý; đã đồng ý ⇒ chờ thanh toán", () => {
    expect(serviceContractStageOf("quoted", false)).toBe("awaiting_acceptance");
    expect(serviceContractStageOf("quoted", true)).toBe("awaiting_payment");
  });

  it("đã trả ⇒ đang thực hiện; VR giao link vẫn đang thực hiện (chờ gắn lô)", () => {
    for (const s of ["paid", "scheduled", "item_pending", "in_review", "delivered"]) {
      expect(serviceContractStageOf(s, true)).toBe("in_progress");
    }
  });

  it("hoàn tất / thay thế ⇒ hoàn tất; huỷ ⇒ đã huỷ", () => {
    expect(serviceContractStageOf("completed", true)).toBe("completed");
    expect(serviceContractStageOf("attached", true)).toBe("completed");
    expect(serviceContractStageOf("superseded", true)).toBe("completed");
    expect(serviceContractStageOf("cancelled", true)).toBe("cancelled");
  });

  it("admin báo giá lại sau khi đồng ý ⇒ hợp đồng cũ hết hiệu lực", () => {
    expect(serviceContractStageOf("quoted", true, false)).toBe("requoted");
  });
});

describe("Bên B từ mẫu", () => {
  it("chuỗi rỗng ⇒ null, giữ đơn vị thực hiện của đơn", () => {
    expect(providerPartyFromClauses({ provider_name: "Công ty A", provider_tax_code: "  " }, "Silver Sea", null)).toEqual({
      name: "Công ty A",
      tax_code: null,
      address: null,
      representative: null,
      rep_title: null,
      email: null,
      partner_name: "Silver Sea",
      expert_name: null,
    });
  });
});

describe("đường dẫn", () => {
  const P = "p1";
  it("thẻ đơn: tư vấn nằm ở tab riêng, VR / giám định ở trang hồ sơ", () => {
    expect(serviceOrderOwnerPath("tu-van-phap-ly", P)).toBe("/chu-tai-san/dang-tai-san/p1?tab=phap-ly");
    expect(serviceOrderOwnerPath("vr-tour", P)).toBe("/chu-tai-san/dang-tai-san/p1");
  });
  it("thanh toán mỗi loại có tham số riêng", () => {
    expect(serviceCheckoutPath("vr-tour", "o1", P)).toContain("vr_order=o1");
    expect(serviceCheckoutPath("giam-dinh", "o1", P)).toContain("gd_order=o1");
    expect(serviceCheckoutPath("tu-van-phap-ly", "o1", P)).toContain("tvpl_order=o1");
    expect(serviceCheckoutPath("tu-van-dau-gia", "o1", P)).toContain("tvdg_order=o1");
  });
});

describe("lỗi RPC", () => {
  it("ok:false ⇒ ném lỗi có câu tiếng Việt", () => {
    expect(() => unwrapServiceContractRpc({ ok: false, reason: "template_changed" })).toThrow(ServiceContractError);
    expect(() => unwrapServiceContractRpc({ ok: false, reason: "template_changed" })).toThrow(/Mẫu hợp đồng vừa được cập nhật/);
    expect(unwrapServiceContractRpc({ ok: true, code: "HDCU000001" })).toMatchObject({ code: "HDCU000001" });
  });
});

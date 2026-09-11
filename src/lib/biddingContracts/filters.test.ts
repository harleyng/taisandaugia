import { describe, expect, it } from "vitest";
import {
  EMPTY_CONTRACT_FILTERS,
  expectedDeposit,
  filterOrgContracts,
  maskIdNumber,
  nextBidderNo,
} from "./filters";
import { contractErrorMessage } from "./errors";

const rows = [
  { session_id: "s1", deposit_status: "pending", code: "HSDG000001", full_name: "Nguyễn Văn An", phone: "0912345678", id_number: "079085123456", bidder_no: null as number | null },
  { session_id: "s1", deposit_status: "received", code: "HSDG000002", full_name: "Đỗ Thị Hà", phone: "0987654321", id_number: "001190654321", bidder_no: 3 },
  { session_id: "s2", deposit_status: "received", code: "HSDG000003", full_name: "Lê Minh", phone: "0901112223", id_number: "B1234567", bidder_no: 1 },
] as const;

describe("filterOrgContracts", () => {
  it("không lọc thì trả đủ", () => {
    expect(filterOrgContracts([...rows], EMPTY_CONTRACT_FILTERS)).toHaveLength(3);
  });

  it("lọc theo phiên + tiền đặt trước", () => {
    const r = filterOrgContracts([...rows], { sessionId: "s1", deposit: "received", q: "" });
    expect(r.map((x) => x.code)).toEqual(["HSDG000002"]);
  });

  it("tìm không dấu theo tên, SĐT, mã, CCCD", () => {
    expect(filterOrgContracts([...rows], { ...EMPTY_CONTRACT_FILTERS, q: "do thi ha" })).toHaveLength(1);
    expect(filterOrgContracts([...rows], { ...EMPTY_CONTRACT_FILTERS, q: "0901" })).toHaveLength(1);
    expect(filterOrgContracts([...rows], { ...EMPTY_CONTRACT_FILTERS, q: "hsdg00000" })).toHaveLength(3);
  });
});

describe("helpers", () => {
  it("nextBidderNo = max + 1", () => {
    expect(nextBidderNo([...rows])).toBe(4);
    expect(nextBidderNo([])).toBe(1);
  });

  it("expectedDeposit cộng lô có khai, null nếu không lô nào khai", () => {
    expect(expectedDeposit([{ deposit_amount: 10_000_000 }, { deposit_amount: null }, { deposit_amount: 5_000_000 }])).toBe(
      15_000_000,
    );
    expect(expectedDeposit([{ deposit_amount: null }])).toBeNull();
  });

  it("maskIdNumber chỉ lộ đầu và cuối", () => {
    expect(maskIdNumber("079085123456")).toBe("079•••••3456");
    expect(maskIdNumber("B12345")).toBe("B1••••");
  });
});

describe("contractErrorMessage", () => {
  it("giữ nguyên câu tiếng Việt do RPC raise, kể cả mã 23505", () => {
    expect(contractErrorMessage({ code: "23505", message: "Mã giao dịch đã được sử dụng." })).toBe(
      "Mã giao dịch đã được sử dụng.",
    );
    expect(contractErrorMessage({ code: "23514", message: "Phiên đã đủ số người đăng ký." })).toBe(
      "Phiên đã đủ số người đăng ký.",
    );
  });

  it("dịch lỗi hệ thống", () => {
    expect(
      contractErrorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "uq_abc_session_bidder_no"' }),
    ).toBe("Số báo danh đã được cấp cho hồ sơ khác trong phiên.");
    expect(contractErrorMessage({ message: "permission denied for function x" })).toBe(
      "Bạn không có quyền thực hiện thao tác này.",
    );
  });
});

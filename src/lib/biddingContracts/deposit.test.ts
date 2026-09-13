import { describe, expect, it } from "vitest";
import { depositActionsFor } from "./deposit";
import type { DepositStatus } from "@/types/bidding-contract";

const ALL: DepositStatus[] = ["pending", "received", "applied", "pending_refund", "refunded", "forfeited"];
const ctx = (o: Partial<{ sessionCancelled: boolean; sessionFinalized: boolean }> = {}) => ({
  sessionCancelled: false,
  sessionFinalized: false,
  ...o,
});

describe("depositActionsFor", () => {
  it("phiên đã chốt: không còn thao tác nào, với MỌI trạng thái", () => {
    for (const s of ALL) {
      const a = depositActionsFor(s, ctx({ sessionFinalized: true }));
      expect(a.targets, s).toEqual([]);
      expect(a.blockedNote, s).toMatch(/đã chốt kết quả/);
    }
  });

  it("applied / pending_refund bị khoá kể cả khi chưa đọc được finalized_at", () => {
    for (const s of ["applied", "pending_refund"] as const) {
      const a = depositActionsFor(s, ctx());
      expect(a.targets, s).toEqual([]);
      expect(a.blockedNote, s).toMatch(/đã chốt kết quả/);
    }
  });

  it("phiên huỷ: chỉ 'đã nhận' mới hoàn trả được", () => {
    expect(depositActionsFor("received", ctx({ sessionCancelled: true })).targets).toEqual(["refunded"]);
  });

  it("phiên huỷ + chưa nhận: không thao tác, có câu giải thích", () => {
    const a = depositActionsFor("pending", ctx({ sessionCancelled: true }));
    expect(a.targets).toEqual([]);
    expect(a.blockedNote).toMatch(/đã huỷ/);
  });

  it("phiên chốt thắng phiên huỷ khi cả hai cùng đúng", () => {
    const a = depositActionsFor("received", ctx({ sessionCancelled: true, sessionFinalized: true }));
    expect(a.targets).toEqual([]);
    expect(a.blockedNote).toMatch(/đã chốt kết quả/);
  });

  it("luồng thường", () => {
    expect(depositActionsFor("pending", ctx()).targets).toEqual(["received"]);
    expect(depositActionsFor("received", ctx()).targets).toEqual(["refunded", "forfeited", "pending"]);
    expect(depositActionsFor("refunded", ctx()).targets).toEqual(["received"]);
    expect(depositActionsFor("forfeited", ctx()).targets).toEqual(["received"]);
  });

  it("có thao tác thì không kèm câu chặn", () => {
    for (const s of ["pending", "received", "refunded", "forfeited"] as const) {
      expect(depositActionsFor(s, ctx()).blockedNote, s).toBeNull();
    }
  });

  it("mọi đích trả về đều nằm trong 4 giá trị org_set_contract_deposit nhận", () => {
    const allowed = new Set(["pending", "received", "refunded", "forfeited"]);
    for (const s of ALL) {
      for (const c of [ctx(), ctx({ sessionCancelled: true }), ctx({ sessionFinalized: true })]) {
        for (const t of depositActionsFor(s, c).targets) expect(allowed.has(t), `${s} → ${t}`).toBe(true);
      }
    }
  });
});

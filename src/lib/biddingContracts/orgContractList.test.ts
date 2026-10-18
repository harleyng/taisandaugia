import { describe, expect, it } from "vitest";
import { depositChoiceLabel, passesOrgListFilters, sortOrgContracts } from "./orgContractList";

type Row = Parameters<typeof passesOrgListFilters>[0];

const row = (p: Partial<Row> = {}): Row => ({
  session_id: "s1",
  review_status: "approved",
  deposit_status: "pending",
  code: "HSDG000001",
  full_name: "Nguyễn Văn An",
  org_name: null,
  phone: "0901234567",
  paid_at: "2026-10-01T02:00:00Z",
  auction_sessions: { code: "PDG000012" },
  ...p,
});

const NONE = { sessionId: "", deposit: "all" as const, q: "" };

describe("passesOrgListFilters", () => {
  it("tìm không dấu theo tên, mã hồ sơ và mã phiên", () => {
    expect(passesOrgListFilters(row(), { ...NONE, q: "nguyen van" })).toBe(true);
    expect(passesOrgListFilters(row(), { ...NONE, q: "pdg000012" })).toBe(true);
    expect(passesOrgListFilters(row(), { ...NONE, q: "khác" })).toBe(false);
  });

  it("lọc theo phiên và trạng thái đặt trước", () => {
    expect(passesOrgListFilters(row(), { ...NONE, sessionId: "s2" })).toBe(false);
    expect(passesOrgListFilters(row(), { ...NONE, deposit: "received" })).toBe(false);
    expect(passesOrgListFilters(row(), { ...NONE, sessionId: "s1", deposit: "pending" })).toBe(true);
  });
});

describe("sortOrgContracts", () => {
  it("chờ duyệt lên đầu, trong nhóm mới nộp trước", () => {
    const sorted = sortOrgContracts([
      row({ code: "A", paid_at: "2026-10-03T00:00:00Z" }),
      row({ code: "B", review_status: "pending", paid_at: "2026-10-01T00:00:00Z" }),
      row({ code: "C", review_status: "pending", paid_at: "2026-10-02T00:00:00Z" }),
    ]);
    expect(sorted.map((r) => r.code)).toEqual(["C", "B", "A"]);
  });
});

it("nhãn lọc đặt trước theo design", () => {
  expect(depositChoiceLabel("all")).toBe("Mọi trạng thái đặt trước");
  expect(depositChoiceLabel("received")).toBe("Đặt trước: Đã nộp");
});

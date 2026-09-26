import { describe, expect, it } from "vitest";
import { gdNextAction, gdStepIndex, isNegativeVerdict, summarizeGdOrders } from "./status";
import { verificationLevel, type VerificationInput } from "./verificationLevel";
import { requiredReasons } from "./requirement";
import { authenticationGateMessage } from "./errors";
import type { AuthenticationOrder } from "@/types/authentication";

const order = (status: string, extra: Partial<AuthenticationOrder> = {}) =>
  ({ id: status, status, method: "ship_item", ...extra }) as AuthenticationOrder;

describe("authentication status", () => {
  it("from_photos skips the item step", () => {
    expect(gdStepIndex("from_photos", "in_review")).toBe(3);
    expect(gdStepIndex("from_photos", "item_pending")).toBe(-1);
    expect(gdStepIndex("ship_item", "item_pending")).toBe(3);
    expect(gdStepIndex("on_site", "completed")).toBe(5);
  });

  it("summarizes active vs current result independently (re-appraisal)", () => {
    const s = summarizeGdOrders([order("in_review"), order("completed"), order("superseded")]);
    expect(s.active?.status).toBe("in_review");
    expect(s.completed?.status).toBe("completed");
  });

  it("next action depends on method", () => {
    expect(gdNextAction(order("paid", { method: "from_photos" }))).toBe("Bắt đầu giám định");
    expect(gdNextAction(order("paid", { method: "on_site" }))).toBe("Hẹn lịch giám định tại chỗ");
    expect(gdNextAction(order("item_pending", { method: "ship_item" }))).toBe("Xác nhận đã nhận hiện vật");
  });

  it("negative verdicts", () => {
    expect(isNegativeVerdict("suspected_fake")).toBe(true);
    expect(isNegativeVerdict("inconclusive")).toBe(true);
    expect(isNegativeVerdict("authentic")).toBe(false);
  });
});

describe("verification level (mirror of SQL)", () => {
  const base: VerificationInput = { ownerKycApproved: false, reviewStatus: "pending", verdict: null, method: null };
  it("authentic certificate always gives ≥ 3", () => {
    expect(verificationLevel({ ...base, verdict: "authentic", method: "from_photos" })).toBe(3);
    expect(verificationLevel({ ...base, verdict: "authentic", method: "on_site" })).toBe(4);
  });
  it("falls back to review / KYC", () => {
    expect(verificationLevel({ ...base, reviewStatus: "approved", ownerKycApproved: true })).toBe(2);
    expect(verificationLevel({ ...base, ownerKycApproved: true, verdict: "suspected_fake" })).toBe(1);
    expect(verificationLevel(base)).toBe(0);
  });
});

describe("required reasons (mirror of SQL)", () => {
  const policy = { enabled: true, min_price: 50_000_000, parent_slugs: ["co-vat-suu-tam"] };
  const base = { parentSlug: "co-vat-suu-tam", startingPrice: 50_000_000, policy, sellerRestricted: false, lotFlagged: false };
  it("policy bites at the threshold, only for listed groups", () => {
    expect(requiredReasons(base)).toEqual(["policy"]);
    expect(requiredReasons({ ...base, startingPrice: 49_999_999 })).toEqual([]);
    expect(requiredReasons({ ...base, parentSlug: "may-moc" })).toEqual([]);
    expect(requiredReasons({ ...base, startingPrice: null })).toEqual([]);
    expect(requiredReasons({ ...base, policy: { ...policy, enabled: false } })).toEqual([]);
  });
  it("seller + lot flags apply in any group", () => {
    expect(requiredReasons({ ...base, parentSlug: "xe-co", sellerRestricted: true, lotFlagged: true })).toEqual([
      "lot_flag",
      "seller_restricted",
    ]);
  });
});

describe("gate error mapping", () => {
  it("maps trigger codes", () => {
    expect(authenticationGateMessage({ message: "GD_REQUIRED: ..." })).toMatch(/bắt buộc/);
    expect(authenticationGateMessage({ message: "GD_FAILED_CATEGORY: ..." })).toMatch(/Cổ vật/);
    expect(authenticationGateMessage(new Error("other"))).toBeNull();
  });
});

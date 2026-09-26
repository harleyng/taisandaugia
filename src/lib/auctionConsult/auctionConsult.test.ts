import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TVDG_REASON_MESSAGES } from "./errors";
import { BIDDING_METHOD_LABELS } from "./labels";
import { depositWarning, draftToValues, proposalToDraft, validateProposal, type ProposalValues } from "./proposal";
import { requestConsultSchema } from "./requestForm";
import { isSuggestionSource, summarizeAuctionConsultations, tvdgStepIndex } from "./status";
import { durationChoice, formatMismatches, LOT_APPLICABLE_FIELDS, suggestedLotValue, suggestionsByPosting } from "./suggestion";
import type { AuctionConsultation, AuctionConsultSuggestion } from "@/types/auctionConsult";

const row = (id: string, status: string, version: number | null = null, seller_decision = "pending") =>
  ({ id, status, version, seller_decision, created_at: id }) as unknown as AuctionConsultation;

const full = (extra: Partial<ProposalValues> = {}): ProposalValues => ({
  auction_format: "truc_tuyen",
  bidding_method: "ascending",
  starting_price: 1_000_000_000,
  reserve_price: null,
  bid_step: 10_000_000,
  lot_duration_minutes: 30,
  deposit_mode: "percent",
  deposit_value: 10,
  rationale: "Thanh khoản tốt",
  field_notes: {},
  ...extra,
});

const suggestion = (extra: Partial<AuctionConsultSuggestion> = {}) =>
  ({
    asset_posting_id: "p1",
    version: 2,
    auction_format: "truc_tuyen",
    starting_price: 1_000_000_000,
    bid_step: 10_000_000,
    deposit_mode: "percent",
    deposit_value: 10,
    lot_duration_minutes: 45,
    ...extra,
  }) as AuctionConsultSuggestion;

describe("status", () => {
  it("summarizes active, current and versions newest first", () => {
    const s = summarizeAuctionConsultations([
      row("a", "superseded", 1),
      row("b", "completed", 2),
      row("c", "paid"),
      row("d", "cancelled"),
    ]);
    expect(s.active?.id).toBe("c");
    expect(s.current?.id).toBe("b");
    expect(s.versions.map((v) => v.version)).toEqual([2, 1]);
  });

  it("puts off-flow statuses outside the stepper", () => {
    expect(tvdgStepIndex("superseded")).toBe(-1);
    expect(tvdgStepIndex("cancelled")).toBe(-1);
    expect(tvdgStepIndex("in_review")).toBe(3);
  });

  it("only the current accepted proposal is suggestion data (BR-CNS-06)", () => {
    expect(isSuggestionSource(row("a", "completed", 1, "accepted"))).toBe(true);
    expect(isSuggestionSource(row("a", "completed", 1, "declined"))).toBe(false);
    expect(isSuggestionSource(row("a", "completed", 1, "pending"))).toBe(false);
    expect(isSuggestionSource(row("a", "superseded", 1, "accepted"))).toBe(false);
  });
});

describe("validateProposal", () => {
  it("allows a partial draft but requires every parameter at completion", () => {
    const partial = full({ bidding_method: null, bid_step: null, deposit_mode: null, deposit_value: null, rationale: null });
    expect(validateProposal(partial, false)).toBeNull();
    expect(validateProposal(partial, true)).toBe("method_required");
    expect(validateProposal(full(), true)).toBeNull();
    expect(validateProposal(full({ rationale: "abc" }), true)).toBe("rationale_required");
  });

  it("requires a lot duration only when bidding is online", () => {
    expect(validateProposal(full({ lot_duration_minutes: null }), true)).toBe("duration_required");
    expect(validateProposal(full({ auction_format: "truc_tiep", lot_duration_minutes: null }), true)).toBeNull();
    expect(validateProposal(full({ lot_duration_minutes: 0 }), false)).toBe("duration_invalid");
    expect(validateProposal(full({ lot_duration_minutes: 1441 }), false)).toBe("duration_invalid");
  });

  it("orders the reserve price by bidding method", () => {
    expect(validateProposal(full({ reserve_price: 900_000_000 }), false)).toBe("reserve_invalid");
    expect(validateProposal(full({ reserve_price: 1_100_000_000 }), false)).toBeNull();
    expect(validateProposal(full({ bidding_method: "descending", reserve_price: 1_100_000_000 }), false)).toBe(
      "reserve_invalid",
    );
    expect(validateProposal(full({ bidding_method: "sealed", reserve_price: 1 }), false)).toBeNull();
  });

  it("checks bid step and deposit", () => {
    expect(validateProposal(full({ bid_step: 2_000_000_000 }), false)).toBe("bid_step_invalid");
    expect(validateProposal(full({ deposit_value: 150 }), false)).toBe("deposit_value_invalid");
    expect(validateProposal(full({ deposit_value: 25 }), true)).toBeNull();
    expect(depositWarning("percent", 25, 1_000_000_000)).not.toBeNull();
    expect(depositWarning("percent", 10, 1_000_000_000)).toBeNull();
    expect(validateProposal(full({ deposit_mode: "amount", deposit_value: 2_000_000_000 }), false)).toBe(
      "deposit_above_price",
    );
    expect(validateProposal(full({ starting_price: Number.NaN }), false)).toBe("starting_price_invalid");
  });

  it("rejects unknown field note keys", () => {
    expect(validateProposal(full({ field_notes: { hack: "x" } as never }), false)).toBe("field_notes_invalid");
    expect(validateProposal(full({ field_notes: { deposit: "10% là mức phổ biến" } }), false)).toBeNull();
  });

  it("drops duration for in-person drafts and empty notes", () => {
    const d = proposalToDraft(null, { posting_auction_format: "truc_tiep", posting_starting_price: 5, expected_price: null });
    const v = draftToValues({ ...d, field_notes: { deposit: "  " } });
    expect(v.lot_duration_minutes).toBeNull();
    expect(v.field_notes).toEqual({});
    expect(v.starting_price).toBe(5);
  });
});

describe("suggestion mapping", () => {
  it("only money fields of a lot can be applied — never reserve or method", () => {
    expect([...LOT_APPLICABLE_FIELDS]).toEqual(["starting_price", "deposit_amount", "bid_step"]);
  });

  it("computes a percent deposit from the form's CURRENT starting price", () => {
    const s = suggestion();
    expect(suggestedLotValue("deposit_amount", s, 2_000_000_000)).toBe(200_000_000);
    expect(suggestedLotValue("deposit_amount", s, null)).toBeNull();
    expect(suggestedLotValue("deposit_amount", suggestion({ deposit_mode: "amount", deposit_value: 50 }), null)).toBe(50);
    expect(suggestedLotValue("bid_step", s, null)).toBe(10_000_000);
  });

  it("flags only posting lots whose proposal format differs from the session", () => {
    const map = suggestionsByPosting([suggestion(), suggestion({ asset_posting_id: "p2", auction_format: "truc_tiep" })]);
    const out = formatMismatches(
      "truc_tiep",
      [
        { asset_posting_id: "p1", title: "Lô A" },
        { asset_posting_id: "p2", title: "Lô B" },
        { asset_posting_id: null, title: "Tin công khai" },
      ],
      map,
    );
    expect(out).toEqual([{ title: "Lô A", version: 2, format: "truc_tuyen" }]);
  });

  it("maps a duration to the Open-lot dialog choice", () => {
    expect(durationChoice(30)).toEqual({ choice: "30" });
    expect(durationChoice(45)).toEqual({ choice: "custom", custom: "45" });
    expect(durationChoice(2000)).toBeNull();
    expect(durationChoice(null)).toBeNull();
  });
});

describe("request form", () => {
  const base = { saleGoal: "balanced", expectedPrice: "", minPrice: "", timeline: "", deadline: "", note: "" };
  it("rejects a minimum above the expected price and a past deadline", () => {
    expect(requestConsultSchema.safeParse({ ...base, expectedPrice: "100", minPrice: "200" }).success).toBe(false);
    expect(requestConsultSchema.safeParse({ ...base, deadline: "2000-01-01" }).success).toBe(false);
    expect(requestConsultSchema.safeParse({ ...base, expectedPrice: "200", minPrice: "100" }).success).toBe(true);
    expect(requestConsultSchema.safeParse({ ...base, saleGoal: undefined }).success).toBe(false);
  });
});

describe("migration sync", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../../supabase/migrations/20260915000040_asset_auction_consultations.sql"),
    "utf8",
  );

  it("every reason the RPCs return has a Vietnamese message", () => {
    const reasons = new Set([
      ...[...sql.matchAll(/'reason',\s*'(\w+)'/g)].map((m) => m[1]),
      ...[...sql.matchAll(/RETURN '(\w+)'/g)].map((m) => m[1]),
    ]);
    const missing = [...reasons].filter((r) => !TVDG_REASON_MESSAGES[r]);
    expect(missing).toEqual([]);
  });

  it("bidding methods match the proposal CHECK", () => {
    const m = sql.match(/bidding_method IN \(([^)]+)\)/);
    const methods = m![1].split(",").map((x) => x.trim().replace(/'/g, ""));
    expect(methods.sort()).toEqual(Object.keys(BIDDING_METHOD_LABELS).sort());
  });
});

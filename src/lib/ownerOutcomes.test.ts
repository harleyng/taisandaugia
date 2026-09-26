import { describe, it, expect } from "vitest";
import {
  OUTCOME_CONFIDENCES,
  OUTCOME_CONFIDENCE_META,
  OUTCOME_KIND_LABEL,
  OUTCOME_SOURCE_KINDS,
  OUTCOME_SOURCE_KIND_LABEL,
  RESOLVED_OUTCOME_KINDS,
  describeOutcomeSource,
  isSoldOutcome,
  mapOutcomeSource,
  mapResolvedOutcomeRow,
  unsoldReasonLabel,
  type ResolvedOutcomeRow,
} from "./ownerOutcomes";

const row = (over: Partial<ResolvedOutcomeRow> = {}): ResolvedOutcomeRow => ({
  listing_id: "l1",
  resolved_outcome: "sold",
  resolved_price: 28450000000,
  resolved_date: "2026-09-13",
  payment_status: "pending",
  confidence_label: "platform",
  has_conflict: false,
  sources: [
    {
      kind: "platform",
      label: "platform",
      outcome: "sold",
      price: 28450000000,
      date: "2026-09-13",
      org_name: "Công ty Đấu giá Hợp danh Bảo Tín",
      session_code: "PDG000013",
      ref_id: "x",
    },
  ],
  ...over,
});

describe("mapResolvedOutcomeRow", () => {
  it("maps a platform row to camelCase", () => {
    const r = mapResolvedOutcomeRow(row());
    expect(r).toMatchObject({
      listingId: "l1",
      outcome: "sold",
      price: 28450000000,
      date: "2026-09-13",
      paymentStatus: "pending",
      confidence: "platform",
      hasConflict: false,
    });
    expect(r.sources[0]).toEqual({
      kind: "platform",
      label: "platform",
      outcome: "sold",
      price: 28450000000,
      date: "2026-09-13",
      orgName: "Công ty Đấu giá Hợp danh Bảo Tín",
      sessionCode: "PDG000013",
      roundNo: null,
      refId: "x",
      paymentStatus: null,
      contractCode: null,
      contractStatus: null,
    });
  });

  it("returns nulls for a listing no source speaks about", () => {
    const r = mapResolvedOutcomeRow(
      row({
        resolved_outcome: null as unknown as string,
        resolved_price: null as unknown as number,
        resolved_date: null as unknown as string,
        payment_status: null as unknown as string,
        confidence_label: null as unknown as string,
        sources: [],
      }),
    );
    expect(r.outcome).toBeNull();
    expect(r.price).toBeNull();
    expect(r.confidence).toBeNull();
    expect(r.paymentStatus).toBeNull();
    expect(r.sources).toEqual([]);
  });

  it("narrows unknown enum values to null instead of passing them through", () => {
    const r = mapResolvedOutcomeRow(
      row({ resolved_outcome: "exploded", confidence_label: "gossip", payment_status: "maybe" }),
    );
    expect(r.outcome).toBeNull();
    expect(r.confidence).toBeNull();
    expect(r.paymentStatus).toBeNull();
  });

  it("accepts numeric strings and survives malformed sources", () => {
    const r = mapResolvedOutcomeRow(
      row({ resolved_price: "8792336264" as unknown as number, sources: [null, "x", { kind: "crawled" }] }),
    );
    expect(r.price).toBe(8792336264);
    expect(r.sources).toHaveLength(3);
    expect(r.sources[0].kind).toBeNull();
    expect(r.sources[2]).toMatchObject({ kind: "crawled", price: null, orgName: null });
  });

  it("treats a non-array sources payload as empty", () => {
    expect(mapResolvedOutcomeRow(row({ sources: {} })).sources).toEqual([]);
  });
});

describe("labels", () => {
  it("has a Vietnamese label for every confidence, outcome and source kind", () => {
    for (const c of OUTCOME_CONFIDENCES) expect(OUTCOME_CONFIDENCE_META[c].label).toBeTruthy();
    for (const k of RESOLVED_OUTCOME_KINDS) expect(OUTCOME_KIND_LABEL[k]).toBeTruthy();
    for (const k of OUTCOME_SOURCE_KINDS) expect(OUTCOME_SOURCE_KIND_LABEL[k]).toBeTruthy();
  });

  it("uses the §A3 wording", () => {
    expect(OUTCOME_CONFIDENCE_META.platform.label).toBe("Sàn xác nhận");
    expect(OUTCOME_CONFIDENCE_META.self_reported.label).toBe("Tự khai");
    expect(OUTCOME_CONFIDENCE_META.estimated.label).toBe("Ước tính");
  });

  it("describes a source with its session and organisation", () => {
    const r = mapResolvedOutcomeRow(row());
    expect(describeOutcomeSource(r.sources[0])).toBe(
      "Phiên trên sàn — PDG000013 · Công ty Đấu giá Hợp danh Bảo Tín",
    );
    expect(describeOutcomeSource({ ...r.sources[0], kind: "crawled", orgName: null, sessionCode: null })).toBe(
      "Tin đăng thu thập",
    );
    expect(describeOutcomeSource(undefined)).toBeNull();
  });

  it("keeps the source row id and its payment status", () => {
    const owner = mapOutcomeSource({ kind: "owner_report", outcome: "sold", ref_id: "o1", payment_status: "partial" });
    expect(owner.refId).toBe("o1");
    expect(owner.paymentStatus).toBe("partial");
    expect(mapOutcomeSource({ kind: "org_report", payment_status: null, ref_id: "" })).toMatchObject({
      refId: null,
      paymentStatus: null,
    });
  });

  it("maps the sale contract of a platform lot (Phase 12)", () => {
    const platform = mapOutcomeSource({
      kind: "platform",
      outcome: "sold",
      contract_code: "HDMB000001",
      contract_status: "signed",
    });
    expect(platform.contractCode).toBe("HDMB000001");
    expect(platform.contractStatus).toBe("signed");
    expect(mapOutcomeSource({ kind: "platform", contract_status: "lost" })).toMatchObject({
      contractCode: null,
      contractStatus: null,
    });
  });

  it("names the round of an owner self-report", () => {
    const owner = mapOutcomeSource({ kind: "owner_report", label: "reconciled", outcome: "sold", round_no: 2, org_name: "Công ty X" });
    expect(owner.roundNo).toBe(2);
    expect(describeOutcomeSource(owner)).toBe("Đơn vị tự khai — Lượt 2 · Công ty X");
  });

  it("labels unsold reasons, passing typed text through", () => {
    expect(unsoldReasonLabel("single_bidder")).toBe("Chỉ 1 người");
    expect(unsoldReasonLabel("Tranh chấp pháp lý")).toBe("Tranh chấp pháp lý");
    expect(unsoldReasonLabel(null)).toBeNull();
  });

  it("only 'sold' counts as sold", () => {
    expect(isSoldOutcome("sold")).toBe(true);
    for (const k of ["unsold", "postponed", "cancelled", "withdrawn", null, undefined] as const) {
      expect(isSoldOutcome(k)).toBe(false);
    }
  });
});

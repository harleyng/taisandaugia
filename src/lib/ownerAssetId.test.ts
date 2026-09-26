import { describe, it, expect } from "vitest";
import { matchAssetId, normalizeAssetIdInput, shortAssetId } from "./ownerAssetId";

const A = "3f9a12bc-1111-4000-8000-000000000001";
const B = "3f9a12bc-2222-4000-8000-000000000002";
const C = "7e00aa01-3333-4000-8000-000000000003";

describe("shortAssetId", () => {
  it("takes the first 8 hex characters, upper-cased", () => {
    expect(shortAssetId(C)).toBe("7E00AA01");
  });
  it("tolerates ids that are not UUIDs", () => {
    expect(shortAssetId("l-a")).toBe("LA");
  });
});

describe("normalizeAssetIdInput", () => {
  it("drops the 'Mã' label, #, spaces and dashes", () => {
    expect(normalizeAssetIdInput("Mã 7E00AA01")).toBe("7e00aa01");
    expect(normalizeAssetIdInput("mã tài sản: #7e00 aa01")).toBe("7e00aa01");
    expect(normalizeAssetIdInput(` ${C} `)).toBe(C.replace(/-/g, ""));
  });
});

describe("matchAssetId", () => {
  const ids = [A, B, C];
  it("matches a unique 8-character code", () => {
    expect(matchAssetId("7E00AA01", ids)).toEqual({ kind: "match", id: C });
  });
  it("matches a full UUID", () => {
    expect(matchAssetId(B, ids)).toEqual({ kind: "match", id: B });
  });
  it("reports a code shared by two listings as ambiguous", () => {
    expect(matchAssetId("3F9A12BC", ids)).toEqual({ kind: "ambiguous" });
    expect(matchAssetId("3F9A12BC1111", ids)).toEqual({ kind: "match", id: A });
  });
  it("reports unknown and malformed codes", () => {
    expect(matchAssetId("DEADBEEF", ids)).toEqual({ kind: "none" });
    expect(matchAssetId("7E00", ids)).toEqual({ kind: "invalid" });
    expect(matchAssetId("NHÀ Q7 01", ids)).toEqual({ kind: "invalid" });
  });
});

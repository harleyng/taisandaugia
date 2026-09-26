import { describe, expect, it } from "vitest";
import { isQuoteExpired, summarizeVrOrders, vrNextAction, vrStepIndex } from "./status";
import type { VrTourOrder } from "@/types/vrTour";

const order = (status: string, extra: Partial<VrTourOrder> = {}) => ({ id: status, status, ...extra }) as VrTourOrder;

describe("vrTour status", () => {
  it("steps follow BR-VR-01 order; cancelled/superseded are off the flow", () => {
    expect(["requested", "quoted", "paid", "scheduled", "delivered", "attached"].map(vrStepIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(vrStepIndex("cancelled")).toBe(-1);
    expect(vrStepIndex("superseded")).toBe(-1);
  });

  it("summarizes active vs attached order independently (re-shoot while a tour is attached)", () => {
    const s = summarizeVrOrders([order("scheduled"), order("attached"), order("cancelled")]);
    expect(s.active?.status).toBe("scheduled");
    expect(s.attached?.status).toBe("attached");
    expect(summarizeVrOrders([order("superseded"), order("cancelled")]).active).toBeNull();
  });

  it("quote expiry", () => {
    const now = Date.parse("2026-09-15T00:00:00Z");
    expect(isQuoteExpired({ quote_expires_at: "2026-09-14T23:59:59Z" }, now)).toBe(true);
    expect(isQuoteExpired({ quote_expires_at: "2026-09-16T00:00:00Z" }, now)).toBe(false);
    expect(isQuoteExpired({ quote_expires_at: null }, now)).toBe(false);
  });

  it("delivered order waits on posting approval before attach", () => {
    expect(vrNextAction("delivered", "pending")).toBe("Chờ duyệt hồ sơ tài sản");
    expect(vrNextAction("delivered", "approved")).toBe("Duyệt & gắn vào lô");
  });
});

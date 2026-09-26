import { afterEach, describe, expect, it } from "vitest";
import { readStoredChoice, writeStoredChoice } from "./storedChoice";

// Node ≥ 22 có localStorage riêng (rỗng khi thiếu --localstorage-file) che mất
// bản của jsdom ⇒ tự cắm một Storage trong bộ nhớ cho từng test.
const install = (storage: Pick<Storage, "getItem" | "setItem">) =>
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string): void => {
      map.set(k, v);
    },
  };
};

const VIEWS = ["table", "kanban"] as const;

describe("readStoredChoice / writeStoredChoice", () => {
  afterEach(() => install(memoryStorage()));

  it("round-trips an allowed value", () => {
    install(memoryStorage());
    writeStoredChoice("owner-assets-view", "kanban");
    expect(readStoredChoice("owner-assets-view", VIEWS, "table")).toBe("kanban");
  });

  it("falls back when nothing is stored or the value is not allowed", () => {
    const s = memoryStorage();
    install(s);
    expect(readStoredChoice("owner-assets-view", VIEWS, "table")).toBe("table");
    s.map.set("owner-assets-view", "grid");
    expect(readStoredChoice("owner-assets-view", VIEWS, "table")).toBe("table");
  });

  it("falls back when reading throws (blocked storage)", () => {
    install({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
    });
    expect(readStoredChoice("owner-assets-view", VIEWS, "table")).toBe("table");
  });

  it("swallows a write that throws (quota / private mode)", () => {
    install({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(() => writeStoredChoice("owner-assets-view", "kanban")).not.toThrow();
  });
});

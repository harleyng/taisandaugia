import { describe, it, expect } from "vitest";
import { isChunkLoadError } from "./ErrorBoundary";

// Nhận diện SAI ở đây tốn kém theo hai chiều:
//  - bỏ sót ⇒ user thấy màn hình lỗi sau mỗi lần deploy thay vì tự tải lại;
//  - nhận nhầm ⇒ bug logic thật bị biến thành vòng lặp reload, che mất lỗi.
describe("isChunkLoadError", () => {
  it("nhận ChunkLoadError theo tên lỗi", () => {
    const e = new Error("bất kỳ");
    e.name = "ChunkLoadError";
    expect(isChunkLoadError(e)).toBe(true);
  });

  it("nhận các thông điệp nạp module thất bại của từng trình duyệt", () => {
    const messages = [
      // Chrome / Edge
      "Failed to fetch dynamically imported module: https://x/assets/Page-abc.js",
      // Firefox
      "error loading dynamically imported module",
      // Safari
      "Importing a module script failed.",
      // webpack-style (workbox/sw)
      "Loading chunk 42 failed.",
      "Loading CSS chunk 7 failed.",
    ];
    for (const m of messages) {
      expect(isChunkLoadError(new Error(m)), m).toBe(true);
    }
  });

  it("KHÔNG nhận nhầm lỗi ứng dụng thường", () => {
    const notChunk = [
      new Error("Cannot read properties of undefined (reading 'id')"),
      new Error("Không đủ credit"),
      new TypeError("x is not a function"),
      new Error(""),
    ];
    for (const e of notChunk) {
      expect(isChunkLoadError(e), e.message).toBe(false);
    }
  });

  it("chịu được giá trị không phải Error", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError("Loading chunk 3 failed")).toBe(true);
    expect(isChunkLoadError({ nope: 1 })).toBe(false);
  });
});

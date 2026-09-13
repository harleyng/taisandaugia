// @vitest-environment node
//
// BẮT BUỘC chạy môi trường node: vitest.config.ts đặt environment 'jsdom' toàn
// cục, mà jsdom 20 KHÔNG cài SubtleCrypto (chỉ có getRandomValues). Thiếu dòng
// pragma trên, test đổ với TypeError khó hiểu và người sửa tiếp theo rất dễ
// "chữa" bằng cách mock digest — đúng thứ phá giá trị duy nhất của test này là
// đối chiếu với vector chuẩn.

import { describe, expect, it } from "vitest";
import { isSha256Hex, sha256Hex, SHA256_HEX } from "./hash";

const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("sha256Hex", () => {
  it("khớp vector chuẩn cho chuỗi rỗng", async () => {
    expect(await sha256Hex(new Blob([]))).toBe(EMPTY);
  });

  it("khớp vector chuẩn cho 'abc'", async () => {
    expect(await sha256Hex(new Blob(["abc"]))).toBe(ABC);
  });

  it("Blob và ArrayBuffer cho cùng kết quả", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes.buffer)).toBe(await sha256Hex(new Blob([bytes])));
  });

  it("luôn ra đúng dạng DB chấp nhận", async () => {
    const hex = await sha256Hex(new Blob(["biên bản đấu giá"]));
    expect(hex).toMatch(SHA256_HEX);
    expect(hex).toBe(hex.toLowerCase());
  });

  it("nội dung khác cho hash khác", async () => {
    expect(await sha256Hex(new Blob(["a"]))).not.toBe(await sha256Hex(new Blob(["b"])));
  });
});

describe("isSha256Hex", () => {
  it("loại chuỗi thiếu ký tự, chữ hoa và rác", () => {
    expect(isSha256Hex(EMPTY)).toBe(true);
    expect(isSha256Hex(EMPTY.slice(0, 63))).toBe(false);
    expect(isSha256Hex(EMPTY.toUpperCase())).toBe(false);
    expect(isSha256Hex(`${EMPTY} `)).toBe(false);
    expect(isSha256Hex("")).toBe(false);
  });
});

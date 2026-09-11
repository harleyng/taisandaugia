import { describe, expect, it } from "vitest";
import { fnv1aHex } from "./hash";
import {
  CASE_SLOTS,
  DRAFT_SLOTS,
  FACT_SLOTS,
  NOTICE_TEMPLATES,
  NOTICE_TEMPLATE_VERSION,
  PUBLISHED_TEMPLATE_HASHES,
} from "./noticeTemplate";

describe("mẫu thông báo đấu giá — khoá câu chữ", () => {
  it("câu chữ của mọi phiên bản đã phát hành KHÔNG đổi", () => {
    for (const [version, template] of Object.entries(NOTICE_TEMPLATES)) {
      expect(
        fnv1aHex(JSON.stringify(template.blocks)),
        `Mẫu ${version} bị sửa câu chữ. Đừng sửa bản đã phát hành — thêm phiên bản mới vào NOTICE_TEMPLATES rồi ghi hash mới.`,
      ).toBe(PUBLISHED_TEMPLATE_HASHES[version]);
    }
  });

  it("phiên bản hiện hành tồn tại và khoá khớp tên", () => {
    expect(NOTICE_TEMPLATES[NOTICE_TEMPLATE_VERSION]).toBeDefined();
    for (const [version, template] of Object.entries(NOTICE_TEMPLATES)) expect(template.version).toBe(version);
  });

  it("mọi ô trỏ tới danh mục đúng nguồn, không ô nào lặp", () => {
    const catalog = { fact: FACT_SLOTS, case: CASE_SLOTS, draft: DRAFT_SLOTS } as const;
    for (const template of Object.values(NOTICE_TEMPLATES)) {
      const seen = new Set<string>();
      for (const block of template.blocks) {
        if (block.kind !== "field") continue;
        for (const s of block.slots) {
          expect(Object.keys(catalog[s.source]), `${s.source}:${s.key}`).toContain(s.key);
          expect(seen.has(`${s.source}:${s.key}`), `lặp ${s.key}`).toBe(false);
          seen.add(`${s.source}:${s.key}`);
        }
      }
    }
  });

  it("khoá ô 'draft' hợp lệ với CHECK notice:[a-z0-9_]+ của DB", () => {
    for (const key of Object.keys(DRAFT_SLOTS)) expect(key).toMatch(/^[a-z0-9_]+$/);
  });
});

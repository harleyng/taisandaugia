import { describe, expect, it } from "vitest";
import { defaultSessionForm, formToSessionInput, sessionFormSchema, sessionToForm } from "./sessionForm";
import type { AuctionSession } from "@/types/auction-session";

const valid = () => ({ ...defaultSessionForm(new Date("2026-09-11T03:00:00Z")), title: "Phiên tháng 10" });

describe("sessionFormSchema", () => {
  it("giá trị mặc định + tên hợp lệ thì qua", () => {
    expect(sessionFormSchema.safeParse(valid()).success).toBe(true);
  });

  it("kết thúc không sau bắt đầu ⇒ lỗi ở ô kết thúc", () => {
    const v = { ...valid(), ends_at: valid().starts_at };
    const r = sessionFormSchema.safeParse(v);
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toContain("ends_at");
  });

  it("hạn nộp hồ sơ sau giờ đấu ⇒ lỗi", () => {
    const v = { ...valid(), registration_end_at: valid().ends_at };
    const r = sessionFormSchema.safeParse(v);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toContain("registration_end_at");
  });

  it("số người tối đa phải là số nguyên dương", () => {
    expect(sessionFormSchema.safeParse({ ...valid(), max_registrants: "0" }).success).toBe(false);
    expect(sessionFormSchema.safeParse({ ...valid(), max_registrants: "12.5" }).success).toBe(false);
    expect(sessionFormSchema.safeParse({ ...valid(), max_registrants: "120" }).success).toBe(true);
  });
});

describe("formToSessionInput", () => {
  it("cắt khoảng trắng, ô trống thành null, số người thành number", () => {
    const input = formToSessionInput({ ...valid(), title: "  Phiên A  ", venue: "   ", max_registrants: "80" });
    expect(input.title).toBe("Phiên A");
    expect(input.venue).toBeNull();
    expect(input.viewing_start_at).toBeNull();
    expect(input.max_registrants).toBe(80);
  });

  it("giá hồ sơ trống hoặc 0 thành null (không bán qua sàn)", () => {
    expect(formToSessionInput({ ...valid(), dossier_fee: "" }).dossier_fee).toBeNull();
    expect(formToSessionInput({ ...valid(), dossier_fee: "0" }).dossier_fee).toBeNull();
    expect(formToSessionInput({ ...valid(), dossier_fee: "500000" }).dossier_fee).toBe(500_000);
    expect(sessionFormSchema.safeParse({ ...valid(), dossier_fee: "12.5" }).success).toBe(false);
  });

  it("khứ hồi từ phiên đã lưu giữ nguyên mốc thời gian", () => {
    const session = {
      title: "Phiên B",
      description: null,
      auction_format: "ca_hai",
      venue: "Hội trường",
      province: "Hà Nội",
      max_registrants: 30,
      dossier_fee: 200_000,
      registration_start_at: "2026-10-01T01:00:00.000Z",
      registration_end_at: "2026-10-08T10:00:00.000Z",
      viewing_start_at: null,
      viewing_end_at: null,
      starts_at: "2026-10-10T02:00:00.000Z",
      ends_at: "2026-10-10T04:00:00.000Z",
    } as AuctionSession;
    const input = formToSessionInput(sessionToForm(session));
    expect(input.starts_at).toBe(session.starts_at);
    expect(input.registration_end_at).toBe(session.registration_end_at);
    expect(input.max_registrants).toBe(30);
    expect(input.dossier_fee).toBe(200_000);
    expect(input.description).toBeNull();
  });
});

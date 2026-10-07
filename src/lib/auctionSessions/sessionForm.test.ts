import { describe, expect, it } from "vitest";
import {
  defaultSessionForm,
  formToSessionInput,
  SESSION_FORMATS,
  sessionFormSchema,
  sessionToForm,
} from "./sessionForm";
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

  it("ca_hai (phiên cũ) mở được nhưng không lưu được; trực tiếp / trực tuyến thì qua", () => {
    for (const f of SESSION_FORMATS) {
      expect(sessionFormSchema.safeParse({ ...valid(), auction_format: f }).success).toBe(true);
    }
    expect(SESSION_FORMATS).not.toContain("ca_hai");
    const r = sessionFormSchema.safeParse({ ...valid(), auction_format: "ca_hai" });
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toEqual(["auction_format"]);
    expect(sessionToForm({ ...(valid() as unknown as AuctionSession), auction_format: "ca_hai" }).auction_format).toBe(
      "ca_hai",
    );
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
      checkin_lead_minutes: 90,
      checkin_grace_minutes: 10,
    } as AuctionSession;
    const input = formToSessionInput(sessionToForm(session));
    expect(input.starts_at).toBe(session.starts_at);
    expect(input.registration_end_at).toBe(session.registration_end_at);
    expect(input.max_registrants).toBe(30);
    expect(input.dossier_fee).toBe(200_000);
    expect(input.description).toBeNull();
    expect(input.checkin_lead_minutes).toBe(90);
    expect(input.checkin_grace_minutes).toBe(10);
  });

  it("phút điểm danh: mặc định 60 / 0, ngoài khoảng CHECK ⇒ lỗi", () => {
    expect(formToSessionInput(valid())).toMatchObject({ checkin_lead_minutes: 60, checkin_grace_minutes: 0 });
    const paths = (v: object) => {
      const r = sessionFormSchema.safeParse({ ...valid(), ...v });
      return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    };
    expect(paths({ checkin_lead_minutes: "10" })).toContain("checkin_lead_minutes");
    expect(paths({ checkin_lead_minutes: "1441" })).toContain("checkin_lead_minutes");
    expect(paths({ checkin_grace_minutes: "61" })).toContain("checkin_grace_minutes");
    expect(paths({ checkin_grace_minutes: "" })).toContain("checkin_grace_minutes");
    expect(paths({ checkin_lead_minutes: "15", checkin_grace_minutes: "60" })).toEqual([]);
  });
});

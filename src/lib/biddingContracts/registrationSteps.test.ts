import { describe, expect, it } from "vitest";
import { registrationDefaults, type IdentityBlockValues } from "./registrationForm";
import {
  canOfferProfileSave,
  emptyIssues,
  firstStepWithIssues,
  issuesForStep,
  profileSaveInput,
  profileSaveIssues,
  withProfileSaveIssues,
} from "./registrationSteps";

const NOW = new Date("2026-10-08T03:00:00Z");
const UID = "8f0c2c1e-0000-4000-8000-000000000001";

const principal = (patch: Partial<IdentityBlockValues> = {}): IdentityBlockValues => ({
  full_name: "Nguyễn Văn An",
  id_type: "cccd",
  id_number: "001099012345",
  date_of_birth: "1985-04-12",
  gender: "male",
  address: "Số 12 Phố Huế, Hai Bà Trưng, Hà Nội",
  id_front_path: `${UID}/front.jpg`,
  id_back_path: `${UID}/back.jpg`,
  read_method: "qr",
  edited_fields: [],
  ...patch,
});

describe("issuesForStep / firstStepWithIssues", () => {
  const all = {
    root: { phone: "sđt", email: "email", attendee: "người dự", consent: "đồng ý" },
    principal: { id_front_path: "ảnh" },
    organization: { tax_code: "mst" },
    proxy: { poa_doc_path: "uq" },
  };

  it("mỗi lỗi về đúng bước của nó", () => {
    expect(issuesForStep(all, 0)).toEqual({ ...emptyIssues(), root: { phone: "sđt", email: "email" }, organization: { tax_code: "mst" } });
    expect(issuesForStep(all, 1)).toEqual({ ...emptyIssues(), principal: { id_front_path: "ảnh" } });
    expect(issuesForStep(all, 2)).toEqual({ ...emptyIssues(), root: { attendee: "người dự" }, proxy: { poa_doc_path: "uq" } });
    expect(issuesForStep(all, 3)).toEqual({ ...emptyIssues(), root: { consent: "đồng ý" } });
  });

  it("nhảy về bước sớm nhất còn lỗi", () => {
    expect(firstStepWithIssues(all)).toBe(0);
    expect(firstStepWithIssues({ ...emptyIssues(), proxy: { phone: "x" }, root: { consent: "y" } })).toBe(2);
    expect(firstStepWithIssues(emptyIssues())).toBeNull();
  });
});

describe("lưu danh tính vào hồ sơ", () => {
  it("chỉ hỏi người đăng ký cá nhân chưa có danh tính lưu", () => {
    const d = registrationDefaults();
    expect(canOfferProfileSave(d, false)).toBe(true);
    expect(canOfferProfileSave(d, true)).toBe(false);
    expect(canOfferProfileSave({ ...d, buyer_kind: "organization" }, false)).toBe(false);
  });

  it("thiếu ngày sinh ⇒ báo lỗi ở khối principal, không dựng tham số", () => {
    const p = principal({ date_of_birth: "" });
    expect(profileSaveIssues(p, NOW)).toEqual({ date_of_birth: "Vui lòng nhập ngày sinh" });
    expect(profileSaveInput(p, NOW)).toBeNull();
    const g = withProfileSaveIssues({ ...emptyIssues(), principal: { full_name: "tên" } }, p, NOW);
    expect(g.principal).toEqual({ full_name: "tên", date_of_birth: "Vui lòng nhập ngày sinh" });
  });

  it("đủ điều kiện ⇒ tham số save_id_photo_identity", () => {
    const input = profileSaveInput({ ...principal(), id_issued_on: "2021-06-01" }, NOW);
    expect(input).toMatchObject({
      id_type: "cccd",
      id_number: "001099012345",
      date_of_birth: "1985-04-12",
      id_front_path: `${UID}/front.jpg`,
      id_back_path: `${UID}/back.jpg`,
      id_issued_on: "2021-06-01",
      read_method: "qr",
    });
  });
});

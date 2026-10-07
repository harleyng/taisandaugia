import { describe, expect, it } from "vitest";
import {
  applySavedIdentity,
  makeRegistrationSchema,
  matchesVneid,
  registrationDefaults,
  toLocalPhone,
  toStartPayload,
  type IdentityBlockValues,
  type RegistrationFormValues,
  type SavedIdentity,
} from "./registrationForm";

const NOW = new Date("2026-10-08T03:00:00Z");
const UID = "8f0c2c1e-0000-4000-8000-000000000001";

const principal = (patch: Partial<IdentityBlockValues> = {}): IdentityBlockValues => ({
  full_name: "Nguyễn Văn An",
  id_type: "cccd",
  id_number: "001 099 012345",
  date_of_birth: "1985-04-12",
  gender: "male",
  address: "Số 12 Phố Huế, Hai Bà Trưng, Hà Nội",
  id_front_path: `${UID}/front.jpg`,
  id_back_path: `${UID}/back.jpg`,
  read_method: "qr",
  edited_fields: ["address"],
  ...patch,
});

const individual = (patch: Partial<RegistrationFormValues> = {}): RegistrationFormValues => ({
  ...registrationDefaults(),
  phone: "0912345678",
  email: "an@example.com",
  principal: principal(),
  consent: true,
  ...patch,
});

const organization = (): RegistrationFormValues =>
  individual({
    buyer_kind: "organization",
    organization: {
      name: "Công ty TNHH Minh Phát",
      tax_code: "0101-234-567",
      address: "25 Láng Hạ, Đống Đa, Hà Nội",
      reg_doc_path: `${UID}/dkkd.pdf`,
    },
  });

const withProxy = (base: RegistrationFormValues): RegistrationFormValues => ({
  ...base,
  attendee: "proxy",
  proxy: {
    ...principal({
      full_name: "Trần Thị Mai",
      id_number: "079190654321",
      gender: "female",
      date_of_birth: "1990-07-20",
      id_front_path: `${UID}/proxy-front.jpg`,
      id_back_path: `${UID}/proxy-back.jpg`,
      edited_fields: [],
    }),
    phone: "0987654321",
    poa_doc_path: `${UID}/poa.pdf`,
  },
});

const issues = (v: RegistrationFormValues, opts: Parameters<typeof makeRegistrationSchema>[0] = {}) => {
  const r = makeRegistrationSchema({ now: NOW, ...opts }).safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("makeRegistrationSchema", () => {
  it("cá nhân / tổ chức / có uỷ quyền đủ thông tin ⇒ hợp lệ", () => {
    expect(issues(individual())).toEqual([]);
    expect(issues(organization())).toEqual([]);
    expect(issues(withProxy(individual()))).toEqual([]);
    expect(issues(withProxy(organization()))).toEqual([]);
  });

  it("khối tổ chức / uỷ quyền bỏ trống không bị kiểm khi không dùng", () => {
    const v = individual();
    expect(v.organization.name).toBe("");
    expect(v.proxy.full_name).toBe("");
    expect(issues(v)).toEqual([]);
  });

  it("danh tính người đăng ký: họ tên, số giấy tờ, địa chỉ, ngày sinh", () => {
    const v = individual({
      principal: principal({ full_name: "An", id_number: "12345", address: "HN", date_of_birth: "2020-01-01" }),
    });
    expect(issues(v)).toEqual([
      "principal.full_name",
      "principal.id_number",
      "principal.address",
      "principal.date_of_birth",
    ]);
  });

  it("hộ chiếu ≥ 6 ký tự và không đòi ảnh mặt sau", () => {
    const v = individual({ principal: principal({ id_type: "passport", id_number: "C1234567", id_back_path: null }) });
    expect(issues(v)).toEqual([]);
    const short = individual({ principal: principal({ id_type: "passport", id_number: "C12", id_back_path: null }) });
    expect(issues(short)).toEqual(["principal.id_number"]);
  });

  it("CCCD thiếu ảnh hai mặt ⇒ báo từng mặt", () => {
    const v = individual({ principal: principal({ id_front_path: null, id_back_path: null }) });
    expect(issues(v)).toEqual(["principal.id_front_path", "principal.id_back_path"]);
  });

  it("khớp VNeID (CCCD + họ tên, không phân biệt hoa thường) ⇒ miễn ảnh", () => {
    const v = individual({ principal: principal({ id_front_path: null, id_back_path: null }) });
    const vneid = { full_name: "NGUYỄN VĂN AN", id_number: "001099012345" };
    expect(issues(v, { vneid })).toEqual([]);
    expect(issues(v, { vneid: { ...vneid, id_number: "001099099999" } })).toContain("principal.id_front_path");
  });

  it("liên hệ + đồng ý chia sẻ", () => {
    expect(issues(individual({ phone: "912345678", email: "an@", consent: false }))).toEqual([
      "phone",
      "email",
      "consent",
    ]);
  });

  it("tổ chức: tên, MST 10/13 số, địa chỉ, ĐKKD", () => {
    const v = organization();
    expect(issues({ ...v, organization: { ...v.organization, tax_code: "0101234567-001" } })).toEqual([]);
    expect(issues({ ...v, organization: { name: "AB", tax_code: "12345", address: "HN", reg_doc_path: null } })).toEqual([
      "organization.name",
      "organization.tax_code",
      "organization.address",
      "organization.reg_doc_path",
    ]);
  });

  it("uỷ quyền: luôn đòi ảnh, SĐT, giấy uỷ quyền, và phải là người khác", () => {
    const v = withProxy(individual());
    const bad: RegistrationFormValues = {
      ...v,
      proxy: { ...v.proxy, id_number: "001099012345", phone: "", poa_doc_path: null, id_front_path: null },
    };
    expect(issues(bad, { vneid: { full_name: "Trần Thị Mai", id_number: "079190654321" } })).toEqual([
      "proxy.id_front_path",
      "proxy.phone",
      "proxy.id_number",
      "proxy.poa_doc_path",
    ]);
  });
});

describe("toStartPayload", () => {
  it("cá nhân tự dự phiên: chuẩn hoá số giấy tờ, không gửi tổ chức, proxy null", () => {
    expect(toStartPayload(individual())).toEqual({
      buyer_kind: "individual",
      phone: "0912345678",
      email: "an@example.com",
      principal: {
        full_name: "Nguyễn Văn An",
        id_type: "cccd",
        id_number: "001099012345",
        date_of_birth: "1985-04-12",
        gender: "male",
        address: "Số 12 Phố Huế, Hai Bà Trưng, Hà Nội",
        id_front_path: `${UID}/front.jpg`,
        id_back_path: `${UID}/back.jpg`,
        read_method: "qr",
        edited_fields: ["address"],
      },
      proxy: null,
    });
  });

  it("tổ chức + uỷ quyền: MST bỏ gạch, đủ khối proxy", () => {
    const p = toStartPayload(withProxy(organization()));
    expect(p.organization).toEqual({
      name: "Công ty TNHH Minh Phát",
      tax_code: "0101234567",
      address: "25 Láng Hạ, Đống Đa, Hà Nội",
      reg_doc_path: `${UID}/dkkd.pdf`,
    });
    expect(p.proxy).toMatchObject({
      full_name: "Trần Thị Mai",
      id_number: "079190654321",
      phone: "0987654321",
      poa_doc_path: `${UID}/poa.pdf`,
      id_front_path: `${UID}/proxy-front.jpg`,
    });
  });

  it("khớp VNeID không ảnh ⇒ không gửi cách đọc / trường đã sửa; ô rỗng ⇒ bỏ hẳn", () => {
    const p = toStartPayload(
      individual({ principal: principal({ id_front_path: null, id_back_path: null, gender: "", date_of_birth: "" }) }),
    );
    expect(p.principal).toEqual({
      full_name: "Nguyễn Văn An",
      id_type: "cccd",
      id_number: "001099012345",
      date_of_birth: undefined,
      gender: undefined,
      address: "Số 12 Phố Huế, Hai Bà Trưng, Hà Nội",
    });
  });

  it("hộ chiếu bỏ ảnh mặt sau còn sót; trường lạ trong edited_fields bị lọc", () => {
    const p = toStartPayload(
      individual({ principal: principal({ id_type: "passport", id_number: "c1234567", edited_fields: ["address", "phone"] }) }),
    );
    expect(p.principal.id_back_path).toBeUndefined();
    expect(p.principal.id_number).toBe("C1234567");
    expect(p.principal.edited_fields).toEqual(["address"]);
  });
});

describe("registrationDefaults / applySavedIdentity", () => {
  const photo: SavedIdentity = {
    source: "id_photo",
    id_type: "cccd",
    full_name: "Nguyễn Văn An",
    id_number: "001099012345",
    date_of_birth: "1985-04-12",
    gender: "male",
    address: "Số 12 Phố Huế, Hà Nội",
    id_front_path: `${UID}/front.jpg`,
    id_back_path: `${UID}/back.jpg`,
    read_method: "qr",
    edited_fields: ["address"],
  };

  it("không có danh tính đã lưu ⇒ điền tên profile, SĐT tài khoản, cá nhân tự dự", () => {
    const d = registrationDefaults({ profileName: " An ", authEmail: "an@example.com", authPhone: "84912345678" });
    expect(d.principal.full_name).toBe("An");
    expect(d.phone).toBe("0912345678");
    expect(d.email).toBe("an@example.com");
    expect(d.buyer_kind).toBe("individual");
    expect(d.attendee).toBe("self");
    expect(d.consent).toBe(false);
  });

  it("liên hệ của hồ sơ gần nhất thắng SĐT / email tài khoản", () => {
    const d = registrationDefaults({
      authEmail: "an@example.com",
      authPhone: "84912345678",
      last: { phone: "0987654321", email: "an.cty@example.com" },
    });
    expect(d.phone).toBe("0987654321");
    expect(d.email).toBe("an.cty@example.com");
  });

  it("chuẩn hoá SĐT tài khoản", () => {
    expect(toLocalPhone("84912345678")).toBe("0912345678");
    expect(toLocalPhone("+84 912 345 678")).toBe("0912345678");
    expect(toLocalPhone("abc")).toBe("");
  });

  it("danh tính ảnh đã lưu ⇒ dùng lại ảnh, người dùng khỏi tải lại", () => {
    const d = registrationDefaults({ profileName: "Khác", saved: photo });
    expect(d.principal).toEqual({
      full_name: "Nguyễn Văn An",
      id_type: "cccd",
      id_number: "001099012345",
      date_of_birth: "1985-04-12",
      gender: "male",
      address: "Số 12 Phố Huế, Hà Nội",
      id_front_path: `${UID}/front.jpg`,
      id_back_path: `${UID}/back.jpg`,
      read_method: "qr",
      edited_fields: ["address"],
    });
    expect(issues({ ...d, phone: "0912345678", email: "an@example.com", consent: true })).toEqual([]);
  });

  it("danh tính VNeID ⇒ không ảnh, khớp VNeID nên vẫn hợp lệ", () => {
    const vneid: SavedIdentity = { ...photo, source: "vneid", id_front_path: null, id_back_path: null };
    const id = applySavedIdentity(vneid);
    expect(id.id_front_path).toBeNull();
    expect(id.read_method).toBe("typed");
    expect(id.edited_fields).toEqual([]);
    expect(matchesVneid(id, vneid)).toBe(true);
  });
});

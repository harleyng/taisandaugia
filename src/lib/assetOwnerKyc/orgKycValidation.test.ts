import { describe, expect, it } from "vitest";
import {
  EMPTY_ORG_KYC_FORM,
  isFreeMailDomain,
  mapOrgKycError,
  validateOrgKycForm,
  type OrgKycForm,
} from "./orgKycValidation";

const orgForm: OrgKycForm = {
  ...EMPTY_ORG_KYC_FORM,
  org_type: "bank_credit",
  org_name: "Ngân hàng TMCP Á Châu",
  tax_code: "0301452948",
  official_email: "kyc@acb.com.vn",
  head_office_address: "442 Nguyễn Thị Minh Khai",
  rep_full_name: "Nguyễn Văn A",
  rep_title: "Giám đốc",
  rep_id_number: "001234567890",
  rep_id_front_url: "u/front.jpg",
  rep_id_back_url: "u/back.jpg",
  rep_selfie_url: "u/selfie.jpg",
  establishment_doc_url: "u/est.pdf",
};

const branchForm: OrgKycForm = {
  ...orgForm,
  kyc_scope: "branch",
  parent_asset_owner_id: "parent-id",
  org_name: "Ngân hàng TMCP Á Châu - Chi nhánh Bình Thạnh",
  tax_code: "",
  rep_title: "Chuyên viên xử lý nợ",
  rep_selfie_url: null,
  establishment_doc_url: null,
  authorization_doc_url: "u/giao-viec.pdf",
};

describe("validateOrgKycForm — organisation (unchanged rules)", () => {
  it("accepts a complete organisation form", () => {
    expect(validateOrgKycForm(orgForm)).toBeNull();
  });

  it("still requires tax code, selfie and establishment doc", () => {
    expect(validateOrgKycForm({ ...orgForm, tax_code: "" })).toMatch(/Mã số thuế/);
    expect(validateOrgKycForm({ ...orgForm, rep_selfie_url: null })).toMatch(/selfie/);
    expect(validateOrgKycForm({ ...orgForm, establishment_doc_url: null })).toMatch(/quyết định thành lập/);
  });

  it("does not require the authorization letter", () => {
    expect(validateOrgKycForm({ ...orgForm, authorization_doc_url: null })).toBeNull();
  });
});

describe("validateOrgKycForm — branch light KYC (D3)", () => {
  it("accepts email + authorization letter + officer ID without establishment doc, selfie or tax code", () => {
    expect(validateOrgKycForm(branchForm)).toBeNull();
  });

  it("requires the parent organisation", () => {
    expect(validateOrgKycForm({ ...branchForm, parent_asset_owner_id: null })).toMatch(/tổ chức mẹ/);
  });

  it("requires the authorization letter", () => {
    expect(validateOrgKycForm({ ...branchForm, authorization_doc_url: null })).toMatch(/uỷ quyền/);
  });

  it("requires a well-formed official email", () => {
    expect(validateOrgKycForm({ ...branchForm, official_email: "a@b" })).toMatch(/Email/);
    expect(validateOrgKycForm({ ...branchForm, official_email: "canbo@gmail.com" })).toBeNull();
  });

  it("keeps officer ID photos mandatory", () => {
    expect(validateOrgKycForm({ ...branchForm, rep_id_back_url: null })).toMatch(/cán bộ được giao/);
  });

  it("validates an optional tax code only when filled", () => {
    expect(validateOrgKycForm({ ...branchForm, tax_code: "12" })).toMatch(/Mã số thuế/);
    expect(validateOrgKycForm({ ...branchForm, tax_code: "0301452948-001" })).toBeNull();
  });
});

describe("isFreeMailDomain", () => {
  it("flags free mailboxes by email or domain", () => {
    expect(isFreeMailDomain("canbo@Gmail.com")).toBe(true);
    expect(isFreeMailDomain("yahoo.com.vn")).toBe(true);
    expect(isFreeMailDomain("canbo@vietcombank.com.vn")).toBe(false);
    expect(isFreeMailDomain(null)).toBe(false);
  });
});

describe("mapOrgKycError", () => {
  it("maps DB guard codes to Vietnamese", () => {
    expect(mapOrgKycError({ message: "branch_workspace_exists" }, "x")).toMatch(/đã có Trạm Điều Hành/);
    expect(mapOrgKycError(new Error("claim_outside_branch"), "x")).toMatch(/đứng tên đơn vị khác/);
  });

  it("falls back for unknown errors", () => {
    expect(mapOrgKycError({ message: "boom" }, "Gửi hồ sơ thất bại")).toBe("Gửi hồ sơ thất bại");
    expect(mapOrgKycError(null, "fallback")).toBe("fallback");
  });
});

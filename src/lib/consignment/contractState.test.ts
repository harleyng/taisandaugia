import { describe, expect, it } from "vitest";
import {
  awaitingSides,
  canAttachSigned,
  canCancel,
  canConfirm,
  canShareDraft,
  contractStepIndex,
  missingPartiesText,
} from "./contractState";
import { contractFileName, contractFilePath, validateContractFile } from "./contractFiles";
import type { ConsignmentContractStatus } from "@/types/consignment-contract";

type ContractFixture = {
  status: ConsignmentContractStatus;
  signed_doc_path: string | null;
  owner_confirmed_at: string | null;
  org_confirmed_at: string | null;
};

const c = (status: ConsignmentContractStatus, extra: Partial<Omit<ContractFixture, "status">> = {}): ContractFixture => ({
  status,
  signed_doc_path: null,
  owner_confirmed_at: null,
  org_confirmed_at: null,
  ...extra,
});

describe("contractState", () => {
  it("thanh tiến trình: huỷ nằm ngoài các bước", () => {
    expect(contractStepIndex("drafting")).toBe(0);
    expect(contractStepIndex("signed")).toBe(3);
    expect(contractStepIndex("cancelled")).toBe(-1);
  });

  it("chỉ tổ chức chia sẻ dự thảo, và chỉ khi hợp đồng còn mở", () => {
    expect(canShareDraft(c("drafting"), "org")).toBe(true);
    expect(canShareDraft(c("drafting"), "owner")).toBe(false);
    expect(canShareDraft(c("signed"), "org")).toBe(false);
  });

  it("đã ký / đã huỷ thì không tải bản ký, không huỷ được nữa", () => {
    for (const s of ["signed", "cancelled"] as const) {
      expect(canAttachSigned(c(s))).toBe(false);
      expect(canCancel(c(s))).toBe(false);
    }
    expect(canAttachSigned(c("awaiting_signatures"))).toBe(true);
  });

  it("xác nhận: cần bản ký, mỗi bên một lần", () => {
    const pending = c("awaiting_confirmation", { signed_doc_path: "o/c/signed-1-a.pdf", org_confirmed_at: "x" });
    expect(canConfirm(pending, "owner")).toBe(true);
    expect(canConfirm(pending, "org")).toBe(false);
    expect(canConfirm(c("awaiting_confirmation"), "owner")).toBe(false);
  });

  it("awaitingSides: soạn & ký là việc của tổ chức; xác nhận là bên chưa xác nhận", () => {
    expect(awaitingSides(c("drafting"))).toEqual(["org"]);
    expect(awaitingSides(c("awaiting_signatures"))).toEqual(["org"]);
    expect(awaitingSides(c("awaiting_confirmation", { owner_confirmed_at: "x" }))).toEqual(["org"]);
    expect(awaitingSides(c("awaiting_confirmation"))).toEqual(["owner", "org"]);
    expect(awaitingSides(c("signed"))).toEqual([]);
  });

  it("câu thông tin còn thiếu", () => {
    expect(missingPartiesText(["owner_address", "org_legal_rep"])).toBe(
      "địa chỉ của chủ tài sản và người đại diện theo pháp luật của tổ chức",
    );
  });
});

describe("contractFiles", () => {
  it("path bắt đầu bằng organization_id rồi contract_id (policy storage đọc hai đoạn này)", () => {
    const p = contractFilePath("org-1", "ct-2", "signed", "Hợp đồng ký (bản cuối).pdf", 123);
    expect(p.startsWith("org-1/ct-2/signed-123-")).toBe(true);
    expect(p).not.toMatch(/\s/);
    expect(contractFileName(p)).toBe(p.split("/").pop()!.replace("signed-123-", ""));
  });

  it("chỉ nhận PDF/JPG/PNG ≤ 10MB", () => {
    expect(validateContractFile({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateContractFile({ type: "application/msword", size: 1000 })).toMatch(/PDF/);
    expect(validateContractFile({ type: "image/png", size: 11 * 1024 * 1024 })).toMatch(/10MB/);
  });
});

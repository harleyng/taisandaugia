import { AuctionCompany } from "@/lib/mockAuctionCompanies";

export interface KYCFormData {
  company: AuctionCompany | null;
  role: "legal_rep" | "authorized_person" | "";
  fullName: string;
  idType: "cccd" | "passport";
  idNumber: string;
  idFront: boolean;
  idBack: boolean;
  selfie: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  doc_dkdn: boolean;
  doc_license: boolean;
  doc_auth: boolean;
  acceptedTerms: boolean;
}

export function sectionStatus(form: KYCFormData) {
  const a = { done: !!form.company && form.company.linkedAccountId == null };
  const b = { done: !!form.role };

  const cFields = [
    { ok: form.fullName.trim().length >= 3, label: "Họ và tên" },
    {
      ok:
        form.idType === "cccd"
          ? /^\d{9,12}$/.test(form.idNumber)
          : form.idNumber.trim().length >= 6,
      label: "Số giấy tờ",
    },
    { ok: form.idFront, label: "Mặt trước" },
    { ok: form.idBack, label: "Mặt sau" },
    { ok: form.selfie, label: "Selfie" },
    { ok: form.phoneVerified, label: "Điện thoại" },
    { ok: form.emailVerified, label: "Email liên hệ" },
  ];
  const c = { done: cFields.every((f) => f.ok), fields: cFields };

  const dReqKeys: string[] = [
    "doc_dkdn",
    "doc_license",
    ...(form.role === "authorized_person" ? ["doc_auth"] : []),
  ];
  const dRows = dReqKeys.map((k) => ({
    k,
    ok: !!(form as unknown as Record<string, unknown>)[k],
  }));
  const d = { done: dRows.length > 0 && dRows.every((f) => f.ok), fields: dRows };

  const progress =
    ((a.done ? 1 : 0) +
      (b.done ? 1 : 0) +
      cFields.filter((f) => f.ok).length / cFields.length +
      dRows.filter((f) => f.ok).length / Math.max(dRows.length, 1)) /
    4;

  return { a, b, c, d, all: a.done && b.done && c.done && d.done, progress };
}

export type SectionStatus = ReturnType<typeof sectionStatus>;

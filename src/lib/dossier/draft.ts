// Hồ sơ dịch vụ trong wizard số hoá (docs/owner-dossier-plan.md §A2, Phase 2):
// giá trị form ⇔ dòng asset_posting_dossier_items.
//
// Thuần (không React, không supabase) để test được. Điểm KHÔNG tính ở đây — chỉ
// quyết định dòng nào được ghi. Các ràng buộc ext_* của bảng được nhân bản trong
// `isExternalComplete`: phần "Đã có đối tác" chưa đủ thì KHÔNG ghi (DB sẽ từ chối),
// cũng KHÔNG xoá dòng đã có — người dùng đang nhập dở.

import { z } from "zod";
import type { TablesInsert } from "@/integrations/supabase/types";
import { APPRAISAL_VALIDITY_MONTHS, type DossierKind, type DossierSource } from "./types";

export const DOSSIER_KINDS: DossierKind[] = ["appraisal", "legal", "auction", "authentication"];

/** "" = chủ chưa chọn ⇒ không có dòng. */
const sourceSchema = z.enum(["", "marketplace", "external_partner", "none"]);
export type DraftSource = z.infer<typeof sourceSchema>;

export const dossierDraftSchema = z.object({
  appraisal: z.object({
    source: sourceSchema,
    /** owner_partners.id ("" = chưa chọn; hồ sơ cũ chỉ có partnerName). */
    partnerId: z.string(),
    partnerName: z.string(),
    /** Chỉ chữ số (như startingPrice). */
    value: z.string(),
    /** yyyy-mm-dd ("" = chưa nhập). */
    issuedAt: z.string(),
    validUntil: z.string(),
    evidence: z.array(z.string()),
    showValue: z.boolean(),
  }),
  legal: z.object({
    source: sourceSchema,
    partnerId: z.string(),
    partnerName: z.string(),
    conclusion: z.enum(["", "clean", "has_issues"]),
    summary: z.string(),
    evidence: z.array(z.string()),
  }),
  auction: z.object({
    source: sourceSchema,
    partnerId: z.string(),
    /** Tổ chức trong danh bạ auction_organizations ("" = tự nhập tên). */
    partnerOrgId: z.string(),
    partnerName: z.string(),
    contractDate: z.string(),
    plannedDate: z.string(),
  }),
  authentication: z.object({
    source: sourceSchema,
    partnerId: z.string(),
    partnerName: z.string(),
    verdict: z.enum(["", "authentic", "inconclusive", "suspected_fake"]),
    certificateNo: z.string(),
    issuedAt: z.string(),
    evidence: z.array(z.string()),
  }),
});

export type DossierDraft = z.infer<typeof dossierDraftSchema>;

export const dossierDraftDefaults: DossierDraft = {
  appraisal: { source: "", partnerId: "", partnerName: "", value: "", issuedAt: "", validUntil: "", evidence: [], showValue: false },
  legal: { source: "", partnerId: "", partnerName: "", conclusion: "", summary: "", evidence: [] },
  auction: { source: "", partnerId: "", partnerOrgId: "", partnerName: "", contractDate: "", plannedDate: "" },
  authentication: { source: "", partnerId: "", partnerName: "", verdict: "", certificateNo: "", issuedAt: "", evidence: [] },
};

export type DossierRowInsert = TablesInsert<"asset_posting_dossier_items">;

/** Các cột dòng dossier mà wizard đọc lại — trùng tên cột trong DB. */
export interface DossierRowLike {
  kind: string;
  source: string;
  partner_id?: string | null;
  partner_org_id: string | null;
  partner_name: string | null;
  issued_at: string | null;
  valid_until: string | null;
  appraised_value: number | null;
  show_appraised_value: boolean;
  legal_conclusion: string | null;
  legal_summary: string | null;
  planned_auction_date: string | null;
  evidence_urls: string[];
  auth_verdict?: string | null;
  certificate_no?: string | null;
}

/**
 * yyyy-mm-dd + n tháng, kẹp về cuối tháng như `date + interval 'n months'` của Postgres
 * (31/08 + 6 tháng = 28/02). Chuỗi rỗng / sai định dạng ⇒ "".
 */
export function addMonths(isoDate: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1 + months, Number(m[3])];
  const year = y + Math.floor(mo / 12);
  const month = ((mo % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Hạn chứng thư điền sẵn từ ngày cấp (D4: 6 tháng). */
export const defaultValidUntil = (issuedAt: string) => addMonths(issuedAt, APPRAISAL_VALIDITY_MONTHS);

const t = (s: string) => s.trim();

/** Phần "Đã có đối tác" đã đủ để ghi chưa (khớp CHECK ext_* + luật hiển thị §A2)? */
export function isExternalComplete(draft: DossierDraft, kind: DossierKind): boolean {
  switch (kind) {
    case "appraisal":
      return (!!draft.appraisal.partnerId || !!t(draft.appraisal.partnerName)) && Number(draft.appraisal.value) > 0;
    case "legal":
      return (
        (!!draft.legal.partnerId || !!t(draft.legal.partnerName)) &&
        !!draft.legal.conclusion &&
        (draft.legal.conclusion === "clean" || !!t(draft.legal.summary))
      );
    case "auction":
      return !!draft.auction.partnerId || !!draft.auction.partnerOrgId || !!t(draft.auction.partnerName);
    case "authentication":
      return (!!draft.authentication.partnerId || !!t(draft.authentication.partnerName)) && !!draft.authentication.verdict;
  }
}

/** Dòng trống cho một phần — mọi cột nghiệp vụ về null để đổi nguồn không để lại dữ liệu cũ. */
function blankRow(postingId: string, kind: DossierKind, source: DossierSource): DossierRowInsert {
  return {
    posting_id: postingId,
    kind,
    source,
    partner_id: null,
    partner_org_id: null,
    partner_name: null,
    issued_at: null,
    valid_until: null,
    appraised_value: null,
    show_appraised_value: false,
    legal_conclusion: null,
    legal_summary: null,
    planned_auction_date: null,
    evidence_urls: [],
    auth_verdict: null,
    certificate_no: null,
  };
}

const orNull = (s: string) => (t(s) ? t(s) : null);

function externalRow(postingId: string, draft: DossierDraft, kind: DossierKind): DossierRowInsert {
  const row = blankRow(postingId, kind, "external_partner");
  if (kind === "appraisal") {
    const a = draft.appraisal;
    return {
      ...row,
      partner_id: a.partnerId || null,
      partner_name: orNull(a.partnerName),
      appraised_value: Number(a.value),
      issued_at: orNull(a.issuedAt),
      valid_until: orNull(a.validUntil),
      show_appraised_value: a.showValue,
      evidence_urls: a.evidence,
    };
  }
  if (kind === "legal") {
    const l = draft.legal;
    return {
      ...row,
      partner_id: l.partnerId || null,
      partner_name: orNull(l.partnerName),
      legal_conclusion: l.conclusion || null,
      // Tóm tắt chỉ có nghĩa khi có vướng mắc.
      legal_summary: l.conclusion === "has_issues" ? orNull(l.summary) : null,
      evidence_urls: l.evidence,
    };
  }
  if (kind === "authentication") {
    const g = draft.authentication;
    return {
      ...row,
      partner_id: g.partnerId || null,
      partner_name: orNull(g.partnerName),
      auth_verdict: g.verdict || null,
      certificate_no: orNull(g.certificateNo),
      issued_at: orNull(g.issuedAt),
      evidence_urls: g.evidence,
    };
  }
  const au = draft.auction;
  return {
    ...row,
    // Có partner_id ⇒ trigger chép lại tên + tổ chức từ owner_partners.
    partner_id: au.partnerId || null,
    // Chọn từ danh bạ thì bỏ tên tự nhập — tên lấy theo tổ chức.
    partner_org_id: au.partnerOrgId || null,
    partner_name: au.partnerOrgId ? null : orNull(au.partnerName),
    issued_at: orNull(au.contractDate),
    planned_auction_date: orNull(au.plannedDate),
  };
}

export interface DossierRowPlan {
  /** Ghi (upsert theo posting_id + kind). */
  upserts: DossierRowInsert[];
  /** Phần chủ để trống ⇒ xoá dòng nếu có. */
  deletes: DossierKind[];
  /** "Đã có đối tác" nhưng thiếu trường bắt buộc ⇒ không ghi, không xoá. */
  incomplete: DossierKind[];
}

/** Giá trị form → kế hoạch ghi bảng asset_posting_dossier_items. */
export function draftToRows(draft: DossierDraft, postingId: string): DossierRowPlan {
  const plan: DossierRowPlan = { upserts: [], deletes: [], incomplete: [] };
  for (const kind of DOSSIER_KINDS) {
    const source = draft[kind].source;
    if (source === "") plan.deletes.push(kind);
    else if (source !== "external_partner") plan.upserts.push(blankRow(postingId, kind, source));
    else if (isExternalComplete(draft, kind)) plan.upserts.push(externalRow(postingId, draft, kind));
    else plan.incomplete.push(kind);
  }
  return plan;
}

/** Phần nào chưa đủ để lưu — StepReview / Hoàn tất cảnh báo. */
export const incompleteKinds = (draft: DossierDraft): DossierKind[] =>
  DOSSIER_KINDS.filter((k) => draft[k].source === "external_partner" && !isExternalComplete(draft, k));

/** "none" (Chưa cần — lựa chọn cũ, đã bỏ) đọc thành chưa chọn: lần lưu sau xoá dòng đó. */
const asSource = (s: string | undefined | null): DraftSource =>
  s === "marketplace" || s === "external_partner" ? s : "";

/**
 * Dòng đã lưu → giá trị form. Phần chưa có dòng nhận nguồn `fallback` (wizard suy
 * "Tìm qua sàn" từ hồ sơ cũ: muốn đấu giá ⇒ tổ chức qua sàn).
 */
export function rowsToDraft(
  rows: readonly DossierRowLike[],
  fallback: Partial<Record<DossierKind, DraftSource>> = {},
): DossierDraft {
  const by = (k: DossierKind) => rows.find((r) => r.kind === k);
  const s = (v: string | null | undefined) => v ?? "";
  const app = by("appraisal");
  const leg = by("legal");
  const auc = by("auction");
  const gd = by("authentication");
  const verdict = (v: string | null | undefined): AuthenticationDraft["verdict"] =>
    v === "authentic" || v === "inconclusive" || v === "suspected_fake" ? v : "";
  return {
    appraisal: app
      ? {
          source: asSource(app.source),
          partnerId: s(app.partner_id),
          partnerName: s(app.partner_name),
          value: app.appraised_value != null ? String(app.appraised_value) : "",
          issuedAt: s(app.issued_at),
          validUntil: s(app.valid_until),
          evidence: app.evidence_urls ?? [],
          showValue: app.show_appraised_value,
        }
      : { ...dossierDraftDefaults.appraisal, source: fallback.appraisal ?? "" },
    legal: leg
      ? {
          source: asSource(leg.source),
          partnerId: s(leg.partner_id),
          partnerName: s(leg.partner_name),
          conclusion: leg.legal_conclusion === "clean" || leg.legal_conclusion === "has_issues" ? leg.legal_conclusion : "",
          summary: s(leg.legal_summary),
          evidence: leg.evidence_urls ?? [],
        }
      : { ...dossierDraftDefaults.legal, source: fallback.legal ?? "" },
    auction: auc
      ? {
          source: asSource(auc.source),
          partnerId: s(auc.partner_id),
          partnerOrgId: s(auc.partner_org_id),
          partnerName: s(auc.partner_name),
          contractDate: s(auc.issued_at),
          plannedDate: s(auc.planned_auction_date),
        }
      : { ...dossierDraftDefaults.auction, source: fallback.auction ?? "" },
    authentication: gd
      ? {
          source: asSource(gd.source),
          partnerId: s(gd.partner_id),
          partnerName: s(gd.partner_name),
          verdict: verdict(gd.auth_verdict),
          certificateNo: s(gd.certificate_no),
          issuedAt: s(gd.issued_at),
          evidence: gd.evidence_urls ?? [],
        }
      : { ...dossierDraftDefaults.authentication, source: fallback.authentication ?? "" },
  };
}

export type AppraisalDraft = DossierDraft["appraisal"];
export type LegalDraft = DossierDraft["legal"];
export type AuctionDraft = DossierDraft["auction"];
export type AuthenticationDraft = DossierDraft["authentication"];

/**
 * Đổi ngày cấp chứng thư: hạn hiệu lực tự theo (+6 tháng) khi người dùng chưa tự sửa
 * hạn — tức hạn đang trống hoặc vẫn là giá trị tự điền từ ngày cấp cũ.
 */
export function withIssuedAt(a: AppraisalDraft, issuedAt: string): Partial<AppraisalDraft> {
  const auto = !a.validUntil || a.validUntil === defaultValidUntil(a.issuedAt);
  return auto ? { issuedAt, validUntil: defaultValidUntil(issuedAt) } : { issuedAt };
}

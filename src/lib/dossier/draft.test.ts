import { describe, expect, it } from "vitest";
import {
  addMonths,
  dossierDraftDefaults,
  draftToRows,
  incompleteKinds,
  rowsToDraft,
  withIssuedAt,
  type DossierDraft,
  type DossierRowLike,
  type DraftSource,
} from "./draft";
import type { DossierKind } from "./types";

const PID = "11111111-1111-1111-1111-111111111111";
const ORG = "22222222-2222-2222-2222-222222222222";

/** Bản nháp có đủ trường "Đã có đối tác" cho cả 4 phần; nguồn đặt theo từng test. */
const full = (src: Partial<Record<DossierKind, DraftSource>> = {}): DossierDraft => ({
  appraisal: {
    source: src.appraisal ?? "",
    partnerId: "",
    partnerName: " Thẩm định ABC ",
    value: "1500000000",
    issuedAt: "2026-09-01",
    validUntil: "2027-03-01",
    evidence: [`${PID}/appraisal/a.pdf`],
    showValue: true,
  },
  legal: {
    source: src.legal ?? "",
    partnerId: "",
    partnerName: "Luật XYZ",
    conclusion: "has_issues",
    summary: "Đang thế chấp",
    evidence: [`${PID}/legal/b.pdf`],
  },
  auction: { source: src.auction ?? "", partnerId: "", partnerOrgId: ORG, partnerName: "", contractDate: "2026-09-10", plannedDate: "" },
  authentication: {
    source: src.authentication ?? "",
    partnerId: "",
    partnerName: "Giám định DEF",
    verdict: "authentic",
    certificateNo: "12/CT-GĐ",
    issuedAt: "2026-09-05",
    evidence: [`${PID}/authentication/c.pdf`],
  },
});

/** Dòng DB giả lập từ một upsert (cột mặc định như bảng). */
const asRow = (r: ReturnType<typeof draftToRows>["upserts"][number]): DossierRowLike => ({
  kind: r.kind,
  source: r.source,
  partner_id: r.partner_id ?? null,
  partner_org_id: r.partner_org_id ?? null,
  partner_name: r.partner_name ?? null,
  issued_at: r.issued_at ?? null,
  valid_until: r.valid_until ?? null,
  appraised_value: r.appraised_value ?? null,
  show_appraised_value: r.show_appraised_value ?? false,
  legal_conclusion: r.legal_conclusion ?? null,
  legal_summary: r.legal_summary ?? null,
  planned_auction_date: r.planned_auction_date ?? null,
  evidence_urls: r.evidence_urls ?? [],
  auth_verdict: r.auth_verdict ?? null,
  certificate_no: r.certificate_no ?? null,
});

const KINDS: DossierKind[] = ["appraisal", "legal", "auction", "authentication"];
const ALL_EXTERNAL = { appraisal: "external_partner", legal: "external_partner", auction: "external_partner", authentication: "external_partner" } as const;
const SOURCES: DraftSource[] = ["marketplace", "external_partner", "none"];

describe("draftToRows — 4 phần × 3 nguồn", () => {
  it.each(KINDS.flatMap((k) => SOURCES.map((s) => [k, s] as const)))("%s · %s ⇒ đúng một dòng upsert", (kind, source) => {
    const plan = draftToRows(full({ [kind]: source }), PID);
    expect(plan.upserts).toHaveLength(1);
    const row = plan.upserts[0];
    expect(row).toMatchObject({ posting_id: PID, kind, source });
    // Các phần còn lại để trống ⇒ xoá nếu có.
    expect(plan.deletes.sort()).toEqual(KINDS.filter((k) => k !== kind).sort());
    if (source !== "external_partner") {
      // Không để lại dữ liệu đối tác khi nguồn không phải "Đã có đối tác".
      expect(row).toMatchObject({
        partner_name: null,
        partner_org_id: null,
        appraised_value: null,
        auth_verdict: null,
        certificate_no: null,
        evidence_urls: [],
      });
    }
  });

  it("đủ dữ liệu đối tác ⇒ ghi đúng cột", () => {
    const plan = draftToRows(full(ALL_EXTERNAL), PID);
    const by = (k: DossierKind) => plan.upserts.find((r) => r.kind === k);
    expect(by("appraisal")).toMatchObject({
      partner_name: "Thẩm định ABC",
      appraised_value: 1500000000,
      issued_at: "2026-09-01",
      valid_until: "2027-03-01",
      show_appraised_value: true,
      evidence_urls: [`${PID}/appraisal/a.pdf`],
    });
    expect(by("legal")).toMatchObject({ legal_conclusion: "has_issues", legal_summary: "Đang thế chấp" });
    expect(by("auction")).toMatchObject({ partner_org_id: ORG, partner_name: null, issued_at: "2026-09-10", planned_auction_date: null });
    expect(by("authentication")).toMatchObject({
      partner_name: "Giám định DEF",
      auth_verdict: "authentic",
      certificate_no: "12/CT-GĐ",
      issued_at: "2026-09-05",
      appraised_value: null,
      evidence_urls: [`${PID}/authentication/c.pdf`],
    });
    expect(by("appraisal")).toMatchObject({ auth_verdict: null });
    expect(plan.deletes).toEqual([]);
  });

  it("pháp lý sạch ⇒ bỏ tóm tắt vướng mắc", () => {
    const d = full({ legal: "external_partner" });
    d.legal.conclusion = "clean";
    expect(draftToRows(d, PID).upserts[0].legal_summary).toBeNull();
  });

  it("đối tác thiếu trường bắt buộc ⇒ không ghi, không xoá", () => {
    const d = full(ALL_EXTERNAL);
    d.appraisal.value = "";
    d.legal.summary = " ";
    d.auction.partnerOrgId = "";
    d.authentication.verdict = "";
    const plan = draftToRows(d, PID);
    expect(plan.upserts).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.incomplete).toEqual(["appraisal", "legal", "auction", "authentication"]);
    expect(incompleteKinds(d)).toEqual(["appraisal", "legal", "auction", "authentication"]);
  });

  it("tổ chức tự nhập tên được chấp nhận khi không chọn từ danh bạ", () => {
    const d = full({ auction: "external_partner" });
    d.auction.partnerOrgId = "";
    d.auction.partnerName = "Công ty ĐG riêng";
    expect(draftToRows(d, PID).upserts[0]).toMatchObject({ partner_org_id: null, partner_name: "Công ty ĐG riêng" });
  });
});

describe("đối tác chọn từ danh bạ owner_partners", () => {
  const PARTNER = "33333333-3333-3333-3333-333333333333";

  it("partnerId ghi vào partner_id và đủ để lưu dù chưa có tên", () => {
    const d = full(ALL_EXTERNAL);
    d.appraisal = { ...d.appraisal, partnerId: PARTNER, partnerName: "" };
    d.authentication = { ...d.authentication, partnerId: PARTNER, partnerName: "" };
    d.legal = { ...d.legal, partnerId: PARTNER, partnerName: "" };
    d.auction = { ...d.auction, partnerId: PARTNER, partnerOrgId: "", partnerName: "" };
    const plan = draftToRows(d, PID);
    expect(plan.incomplete).toEqual([]);
    for (const r of plan.upserts) expect(r.partner_id).toBe(PARTNER);
  });

  it("nguồn không phải đối tác riêng ⇒ không giữ partner_id", () => {
    const d = full({ legal: "marketplace" });
    d.legal.partnerId = PARTNER;
    expect(draftToRows(d, PID).upserts[0].partner_id).toBeNull();
  });

  it("khứ hồi giữ partnerId", () => {
    const d = full({ auction: "external_partner" });
    d.auction.partnerId = PARTNER;
    expect(rowsToDraft(draftToRows(d, PID).upserts.map(asRow)).auction.partnerId).toBe(PARTNER);
  });
});

describe("rowsToDraft ⇔ draftToRows", () => {
  it.each(["marketplace", "external_partner"] as const)("khứ hồi giữ nguyên giá trị — cả 4 phần nguồn %s", (source) => {
    const d = full({ appraisal: source, legal: source, auction: source, authentication: source });
    const back = rowsToDraft(draftToRows(d, PID).upserts.map(asRow));
    for (const k of KINDS) expect(back[k].source).toBe(source);
    if (source === "external_partner") {
      expect(back.appraisal).toEqual({ ...d.appraisal, partnerName: "Thẩm định ABC" });
      expect(back.legal).toEqual(d.legal);
      expect(back.auction).toEqual(d.auction);
      expect(back.authentication).toEqual(d.authentication);
    }
  });

  it("không có dòng ⇒ mặc định, hoặc nguồn suy từ luồng cũ", () => {
    expect(rowsToDraft([])).toEqual(dossierDraftDefaults);
    const d = rowsToDraft([], { appraisal: "marketplace", auction: "marketplace" });
    expect(d.appraisal.source).toBe("marketplace");
    expect(d.legal.source).toBe("");
    expect(d.auction.source).toBe("marketplace");
  });

  it("dòng đã lưu thắng nguồn suy ra", () => {
    const row = asRow(draftToRows(full({ auction: "external_partner" }), PID).upserts[0]);
    expect(rowsToDraft([row], { auction: "marketplace" }).auction.source).toBe("external_partner");
  });

  it("dòng cũ Chưa cần (none) đọc thành chưa chọn ⇒ lần lưu sau xoá dòng", () => {
    const row = asRow(draftToRows(full({ legal: "none" }), PID).upserts[0]);
    const back = rowsToDraft([row]);
    expect(back.legal.source).toBe("");
    expect(draftToRows(back, PID).deletes).toContain("legal");
  });
});

describe("hạn chứng thư", () => {
  it("addMonths kẹp cuối tháng như Postgres", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2026-01-15", 6)).toBe("2026-07-15");
    expect(addMonths("2026-09-30", 6)).toBe("2027-03-30");
    expect(addMonths("", 6)).toBe("");
  });

  it("withIssuedAt: hạn tự theo ngày cấp cho tới khi người dùng sửa tay", () => {
    const a = { ...dossierDraftDefaults.appraisal };
    const p1 = withIssuedAt(a, "2026-09-01");
    expect(p1).toEqual({ issuedAt: "2026-09-01", validUntil: "2027-03-01" });
    // Vẫn là giá trị tự điền ⇒ đổi ngày cấp thì hạn đi theo.
    expect(withIssuedAt({ ...a, ...p1 }, "2026-10-01")).toEqual({ issuedAt: "2026-10-01", validUntil: "2027-04-01" });
    // Đã sửa tay ⇒ giữ.
    expect(withIssuedAt({ ...a, issuedAt: "2026-09-01", validUntil: "2026-12-31" }, "2026-10-01")).toEqual({
      issuedAt: "2026-10-01",
    });
  });
});

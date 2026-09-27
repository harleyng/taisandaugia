// Form "Khai kết quả phiên" của Trạm Điều Hành (docs/owner-control-tower-plan.md Phase 6).
//
// Thuần (không React/Supabase client) để test được. Server là bên quyết định:
// trigger `owner_asset_outcomes_guard` ép reported_by, suy chi nhánh + tổ chức
// đấu giá từ tin, chặn tin ngoài danh mục; RLS chặn người không có quyền ghi.
// Module này chỉ dựng dòng INSERT và nói lỗi bằng tiếng Việt.

import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { UNSOLD_REASONS } from "@/lib/ownerOutcomes";
import type { AssetOwnerClaim } from "@/types/asset-owner";
import { SALE_FILE_ACCEPT, saleSafeName, validateSaleFile } from "@/lib/saleContracts/files";

/** Ba lựa chọn trên màn hình; "void" gộp hoãn / huỷ / rút (chọn tiếp ở bước sau). */
export const REPORT_KINDS = ["sold", "unsold", "void"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const VOID_OUTCOMES = ["postponed", "cancelled", "withdrawn"] as const;
export type VoidOutcome = (typeof VOID_OUTCOMES)[number];

export const REPORT_KIND_META: Record<ReportKind, { label: string }> = {
  sold: { label: "Thành" },
  unsold: { label: "Không thành" },
  void: { label: "Hoãn-Huỷ" },
};

export const VOID_OUTCOME_LABEL: Record<VoidOutcome, string> = {
  postponed: "Hoãn",
  cancelled: "Huỷ",
  withdrawn: "Rút khỏi phiên",
};

/** Tài sản TRÊN SÀN được khai (tin thuộc danh mục của đơn vị). */
export interface ReportOutcomeTarget {
  listingId: string;
  title: string;
  startingPrice: number | null;
  /** custom_attributes.auction_time / auction_date của tin — để điền sẵn ngày. */
  auctionTime: string | null;
}

/**
 * Tài sản NGOÀI sàn (Phase 8): tên / loại / tổ chức / chi nhánh nhập ngay trong
 * dialog. Có `titleKey` ⇒ khai lượt tiếp theo của tài sản ngoài sàn đã có
 * (định danh = tên chuẩn hoá, cột owner_asset_outcomes.title_key).
 */
export interface OffPlatformOutcomeTarget {
  kind: "offplatform";
  title?: string;
  titleKey?: string | null;
  assetCategory?: string | null;
  auctionOrgId?: string | null;
  branchId?: string | null;
  startingPrice?: number | null;
}

export type OutcomeDialogTarget = ReportOutcomeTarget | OffPlatformOutcomeTarget;

export function isOffPlatformTarget(t: OutcomeDialogTarget | null | undefined): t is OffPlatformOutcomeTarget {
  return !!t && "kind" in t && t.kind === "offplatform";
}

/** Khoá ổn định của target — để dialog biết đã dựng form cho ĐÚNG tài sản chưa. */
export function outcomeTargetKey(t: OutcomeDialogTarget): string {
  if (!isOffPlatformTarget(t)) return `l:${t.listingId}`;
  return t.titleKey ? `t:${t.titleKey}` : "t:new";
}

/** Dòng bảng tài sản ⇒ target của dialog. Claim chưa gắn tin ⇒ null (chưa khai được ở Phase 6). */
export function claimToReportTarget(claim: AssetOwnerClaim): ReportOutcomeTarget | null {
  if (!claim.listing_id) return null;
  const ca = claim.listing?.custom_attributes ?? null;
  const time = ca?.auction_time ?? ca?.auction_date;
  const price = Number(claim.listing?.price);
  return {
    listingId: claim.listing_id,
    title: claim.listing?.title ?? claim.asset_owner?.name ?? "Tài sản",
    startingPrice: Number.isFinite(price) && price > 0 ? price : null,
    auctionTime: typeof time === "string" ? time : null,
  };
}

// ─── Ngày ────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" theo giờ máy người dùng (không phải UTC — 7h sáng VN vẫn là "hôm nay"). */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Ngày của một chuỗi thời điểm bất kỳ trong custom_attributes; rác ⇒ null. */
export function isoDayOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (ISO_DAY.test(raw)) return raw;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return todayIso(d);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const digits = z.string().regex(/^\d*$/, "Chỉ nhập số");

export interface ReportOutcomeSchemaOptions {
  /** Tài sản ngoài sàn: bắt buộc tên (3–300 ký tự). */
  offPlatform?: boolean;
  /** Cán bộ bị giới hạn chi nhánh: bản ghi ngoài sàn phải gắn chi nhánh (RLS). */
  branchRequired?: boolean;
}

export function makeReportOutcomeSchema(today: string = todayIso(), opts: ReportOutcomeSchemaOptions = {}) {
  return z
    .object({
      kind: z.enum(REPORT_KINDS),
      roundNo: z.string().regex(/^\d+$/, "Nhập số lượt"),
      auctionDate: z.string().regex(ISO_DAY, "Chọn ngày đấu giá"),
      winningPrice: digits,
      participants: digits,
      unsoldReason: z.enum(UNSOLD_REASONS).nullable(),
      voidOutcome: z.enum(VOID_OUTCOMES),
      note: z.string().max(500, "Tối đa 500 ký tự"),
      // Chỉ dùng cho tài sản ngoài sàn (Phase 8); tài sản trên sàn bỏ qua.
      assetTitle: z.string().max(300, "Tối đa 300 ký tự").optional(),
      assetCategory: z.string().nullable().optional(),
      auctionOrgId: z.string().nullable().optional(),
      branchId: z.string().nullable().optional(),
      startingPrice: digits.optional(),
    })
    .superRefine((v, ctx) => {
      if (opts.offPlatform && (v.assetTitle ?? "").trim().length < 3) {
        ctx.addIssue({ code: "custom", path: ["assetTitle"], message: "Nhập tên tài sản (ít nhất 3 ký tự)" });
      }
      if (opts.offPlatform && opts.branchRequired && !v.branchId) {
        ctx.addIssue({ code: "custom", path: ["branchId"], message: "Chọn chi nhánh trong phạm vi của bạn" });
      }
      const round = Number(v.roundNo);
      if (v.roundNo && (round < 1 || round > 99)) {
        ctx.addIssue({ code: "custom", path: ["roundNo"], message: "Lượt từ 1 đến 99" });
      }
      if (v.auctionDate > today) {
        ctx.addIssue({ code: "custom", path: ["auctionDate"], message: "Ngày đấu giá không được sau hôm nay" });
      }
      if (v.kind === "sold") {
        if (!v.winningPrice || Number(v.winningPrice) <= 0) {
          ctx.addIssue({ code: "custom", path: ["winningPrice"], message: "Nhập giá trúng" });
        }
        if (v.participants && Number(v.participants) < 1) {
          ctx.addIssue({ code: "custom", path: ["participants"], message: "Phiên thành có ít nhất 1 người tham gia" });
        }
      }
      if (v.kind === "unsold" && !v.unsoldReason) {
        ctx.addIssue({ code: "custom", path: ["unsoldReason"], message: "Chọn lý do" });
      }
    });
}

export type ReportOutcomeForm = z.infer<ReturnType<typeof makeReportOutcomeSchema>>;

/**
 * Giá trị mở dialog. Lượt = lượt lớn nhất đã khai + 1 (bằng "số lượt đã khai + 1"
 * khi các lượt liền nhau, và không đụng unique index khi có lượt bị bỏ qua).
 * Ngày = ngày đấu giá của tin nếu đã qua, không thì hôm nay.
 */
export function buildOutcomeDefaults(
  target: OutcomeDialogTarget,
  reportedRounds: number[],
  kind: ReportKind = "sold",
  today: string = todayIso(),
): ReportOutcomeForm {
  const nextRound = reportedRounds.length ? Math.max(...reportedRounds) + 1 : 1;
  const startingPrice = target.startingPrice && target.startingPrice > 0 ? String(Math.round(target.startingPrice)) : "";
  const base: Omit<ReportOutcomeForm, "auctionDate"> = {
    kind,
    roundNo: String(nextRound),
    winningPrice: startingPrice,
    participants: "",
    unsoldReason: null,
    voidOutcome: "postponed",
    note: "",
  };
  if (isOffPlatformTarget(target)) {
    return {
      ...base,
      auctionDate: today,
      assetTitle: target.title ?? "",
      assetCategory: target.assetCategory ?? null,
      auctionOrgId: target.auctionOrgId ?? null,
      branchId: target.branchId ?? null,
      startingPrice,
    };
  }
  const auctionDay = isoDayOf(target.auctionTime);
  return { ...base, auctionDate: auctionDay && auctionDay <= today ? auctionDay : today };
}

// ─── Dòng INSERT ─────────────────────────────────────────────────────────────

export type OwnerOutcomeInsert = Database["public"]["Tables"]["owner_asset_outcomes"]["Insert"];

export interface OutcomeInsertContext {
  /** Sinh ở client để biết trước thư mục biên bản {workspace}/{id}/. */
  id: string;
  workspaceId: string;
  target: OutcomeDialogTarget;
  /** Bắt buộc theo kiểu, nhưng server luôn ghi đè bằng auth.uid(). */
  reportedBy: string;
}

/** "5000000000" ⇒ 5000000000; trống / 0 ⇒ null. */
const positiveOrNull = (raw: string | undefined): number | null => {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

export function toOutcomeInsert(form: ReportOutcomeForm, ctx: OutcomeInsertContext): OwnerOutcomeInsert {
  const note = form.note.trim();
  const outcome = form.kind === "void" ? form.voidOutcome : form.kind;

  let failureReason: string | null = null;
  let participants: number | null = null;
  if (form.kind === "sold") {
    participants = form.participants ? Number(form.participants) : null;
  } else if (form.kind === "unsold") {
    failureReason = form.unsoldReason === "other" ? note || "other" : form.unsoldReason;
    if (form.unsoldReason === "no_registrants") participants = 0;
    if (form.unsoldReason === "single_bidder") participants = 1;
  } else {
    failureReason = note || null;
  }

  const common = {
    id: ctx.id,
    workspace_id: ctx.workspaceId,
    round_no: Number(form.roundNo),
    auction_date: form.auctionDate,
    outcome,
    failure_reason: failureReason,
    winning_price: form.kind === "sold" ? Number(form.winningPrice) : null,
    participants,
    source: "owner_manual",
    reported_by: ctx.reportedBy,
  };

  if (isOffPlatformTarget(ctx.target)) {
    // Tài sản ngoài sàn: định danh = tên (server chuẩn hoá thành title_key).
    return {
      ...common,
      listing_id: null,
      asset_title: (form.assetTitle ?? "").trim(),
      asset_category: form.assetCategory || null,
      auction_org_id: form.auctionOrgId || null,
      branch_id: form.branchId || null,
      starting_price: positiveOrNull(form.startingPrice),
    };
  }

  return {
    ...common,
    listing_id: ctx.target.listingId,
    starting_price: ctx.target.startingPrice && ctx.target.startingPrice > 0 ? Math.round(ctx.target.startingPrice) : null,
  };
}

// ─── Biên bản (bucket PRIVATE) ───────────────────────────────────────────────
// Path BẮT BUỘC {workspace_id}/{outcome_id}/…: policy storage và trigger guard
// đều tách hai đoạn đầu. Lưu PATH vào evidence_urls, mở bằng createSignedUrl.

export const OWNER_EVIDENCE_BUCKET = "owner-outcome-evidence";
export const EVIDENCE_ACCEPT = SALE_FILE_ACCEPT;
/** Cùng luật toàn dự án: PDF/JPG/PNG, tối đa 10MB. Trả câu lỗi hoặc null. */
export const validateEvidenceFile = validateSaleFile;

export function evidenceObjectPath(
  workspaceId: string,
  outcomeId: string,
  fileName: string,
  now: number = Date.now(),
): string {
  return `${workspaceId}/${outcomeId}/bien-ban-${now}-${saleSafeName(fileName)}`;
}

// ─── Lỗi ─────────────────────────────────────────────────────────────────────

export function outcomeErrorMessage(err: unknown, roundNo?: number): string {
  const e = (err && typeof err === "object" ? err : {}) as { code?: string; message?: string };
  if (e.code === "23505") {
    return `${roundNo ? `Lượt ${roundNo}` : "Lượt này"} đã được khai cho tài sản này. Chọn lượt khác.`;
  }
  if (e.code === "42501") return "Bạn không có quyền khai kết quả cho tài sản này (ngoài phạm vi chi nhánh của bạn).";
  if (e.code === "23514") {
    if (/outcome_title_len|outcome_needs_asset/.test(e.message ?? "")) return "Tên tài sản cần từ 3 đến 300 ký tự.";
    return "Phiên thành phải có giá trúng.";
  }
  // Câu tiếng Việt từ trigger guard ("Tài sản này không thuộc danh mục của đơn vị", …).
  if (e.code === "P0001" && e.message) return e.message;
  return "Không lưu được kết quả. Vui lòng thử lại.";
}

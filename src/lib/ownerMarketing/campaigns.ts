// Chiến dịch truyền thông của Trạm Điều Hành — Phase M2 (docs/owner-marketing-plan.md).
//
// Thuần (không React/Supabase). Luật ở server (migration 20261002100000):
//   • facts_snapshot do SERVER dựng (owner_mkt_build_facts) — client chỉ đọc.
//   • drafts chỉ nhận khoá email{subject,body} / zalo|facebook|sms{body}; khoá lạ bị từ chối.
//   • draft → pending_approval → approved → sent; pending_approval → rejected → (sửa) → draft.
//   • Duyệt / từ chối: truyen-thong:finalize, người duyệt ≠ người soạn / người gửi duyệt
//     (trừ Trạm 1 thành viên). Gửi / xuất: truyen-thong:share.
//   • Tài sản = tin trên sàn Trạm đã nhận (listing_ids) và / hoặc hồ sơ số hoá đã duyệt
//     (posting_ids), tổng 1..20. Duyệt ⇒ một link Hồ sơ online / tài sản / kênh (20261004210200).

import { Mail, MessageCircle, MessageSquareText, ThumbsUp, type LucideIcon } from "lucide-react";
import { z } from "zod";
import type { OwnerTone } from "@/components/asset-owner-portal/ui/IconTile";

// ─── Kênh ────────────────────────────────────────────────────────────────────

export const CAMPAIGN_CHANNELS = ["zalo", "facebook", "email", "sms"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_CHANNEL_META: Record<CampaignChannel, { label: string; icon: LucideIcon; hint: string }> = {
  zalo: { label: "Zalo", icon: MessageCircle, hint: "Nhóm Zalo, Zalo OA hoặc tin nhắn của cán bộ" },
  facebook: { label: "Facebook", icon: ThumbsUp, hint: "Trang hoặc nhóm Facebook của đơn vị" },
  email: { label: "Email", icon: Mail, hint: "Email đơn vị tự gửi cho khách của mình" },
  sms: { label: "SMS", icon: MessageSquareText, hint: "SMS brandname — không dấu, mỗi tài sản một tin" },
};

export function isCampaignChannel(v: unknown): v is CampaignChannel {
  return typeof v === "string" && (CAMPAIGN_CHANNELS as readonly string[]).includes(v);
}

/** Giới hạn phần mô tả — khớp owner_mkt_drafts_check. */
export const DRAFT_LIMITS = { subject: 150, email: 5000, zalo: 3000, facebook: 3000, sms: 80 } as const;
export const CAMPAIGN_NAME_MIN = 3;
export const CAMPAIGN_NAME_MAX = 120;
export const CAMPAIGN_NOTES_MAX = 1000;
export const CAMPAIGN_MAX_ASSETS = 20;
export const REJECT_REASON_MIN = 3;
export const REJECT_REASON_MAX = 500;

// ─── Dữ kiện (đọc từ thông báo đấu giá) ──────────────────────────────────────

const str = z.string().nullable().catch(null);
const num = z.coerce.number().nullable().catch(null);

const assetFactsSchema = z.object({
  /** id tin (kind "listing") hoặc id hồ sơ số hoá (kind "posting") — khoá ghép link theo tài sản. */
  asset_id: z.string(),
  kind: z.enum(["listing", "posting"]).catch("listing"),
  listing_id: str,
  /** Mã hồ sơ (HS-0001) — chỉ hồ sơ số hoá. */
  posting_code: str,
  title: z.string().catch("Tài sản"),
  category_slug: str,
  province: str,
  district: str,
  area: num,
  image_url: str,
  announced: z.boolean().catch(false),
  source: z.enum(["session", "notice"]).nullable().catch(null),
  session_code: str,
  lot_no: num,
  starting_price: num,
  deposit: num,
  bid_step: num,
  dossier_fee: num,
  auction_at: str,
  registration_start_at: str,
  registration_end_at: str,
  viewing_start_at: str,
  viewing_end_at: str,
  venue: str,
  auction_format: str,
  org_name: str,
  org_phone: str,
  org_address: str,
});
export type AssetFacts = z.infer<typeof assetFactsSchema>;

export interface FactsSnapshot {
  builtAt: string | null;
  assets: AssetFacts[];
}

const numOrNull = (v: unknown) => (v == null || v === "" ? null : v);

/** jsonb bất kỳ → snapshot hợp lệ; tài sản hỏng bị bỏ, không ném lỗi. */
export function parseFacts(raw: unknown): FactsSnapshot {
  const obj = (raw && typeof raw === "object" ? raw : {}) as { built_at?: unknown; assets?: unknown };
  const list = Array.isArray(obj.assets) ? obj.assets : [];
  const assets = list.flatMap((a) => {
    if (!a || typeof a !== "object") return [];
    const cleaned: Record<string, unknown> = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, numOrNull(v)]));
    // Snapshot trước 20261004210200 chỉ có listing_id.
    cleaned.asset_id ??= cleaned.listing_id;
    const r = assetFactsSchema.safeParse(cleaned);
    return r.success ? [r.data] : [];
  });
  return { builtAt: typeof obj.built_at === "string" ? obj.built_at : null, assets };
}

// ─── Bản nháp (phần mô tả sửa được) ──────────────────────────────────────────

export interface CampaignDrafts {
  email: { subject: string; body: string };
  zalo: { body: string };
  facebook: { body: string };
  sms: { body: string };
}

export const EMPTY_DRAFTS: CampaignDrafts = {
  email: { subject: "", body: "" },
  zalo: { body: "" },
  facebook: { body: "" },
  sms: { body: "" },
};

const s = (v: unknown) => (typeof v === "string" ? v : "");

export function parseDrafts(raw: unknown): CampaignDrafts {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  return {
    email: { subject: s(o.email?.subject), body: s(o.email?.body) },
    zalo: { body: s(o.zalo?.body) },
    facebook: { body: s(o.facebook?.body) },
    sms: { body: s(o.sms?.body) },
  };
}

/** Chỉ gửi lên đúng các khoá server nhận, cho đúng các kênh đã chọn. */
export function draftsPayload(
  drafts: CampaignDrafts,
  channels: readonly CampaignChannel[],
): Record<string, { subject?: string; body: string }> {
  const out: Record<string, { subject?: string; body: string }> = {};
  for (const c of channels) {
    out[c] = c === "email" ? { subject: drafts.email.subject, body: drafts.email.body } : { body: drafts[c].body };
  }
  return out;
}

export function channelDraftDone(drafts: CampaignDrafts, c: CampaignChannel): boolean {
  if (c === "email") return !!drafts.email.subject.trim() && !!drafts.email.body.trim();
  return !!drafts[c].body.trim();
}

// ─── Trạng thái ──────────────────────────────────────────────────────────────

export type CampaignStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "sending"
  | "sent"
  | "ended"
  | "rejected";

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; tone: OwnerTone }> = {
  draft: { label: "Nháp", tone: "muted" },
  pending_approval: { label: "Chờ duyệt", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "primary" },
  scheduled: { label: "Đã lên lịch", tone: "primary" },
  sending: { label: "Đang gửi", tone: "primary" },
  sent: { label: "Đã gửi", tone: "success" },
  ended: { label: "Đã kết thúc", tone: "muted" },
  rejected: { label: "Bị từ chối", tone: "destructive" },
};

export function campaignStatusOf(v: string): CampaignStatus {
  return v in CAMPAIGN_STATUS_META ? (v as CampaignStatus) : "draft";
}

export const isEditableStatus = (st: CampaignStatus) => st === "draft" || st === "rejected";
/** Đã duyệt ⇒ có link theo dõi, xuất được. */
export const isExportableStatus = (st: CampaignStatus) => st === "approved" || st === "sent";
/** Đã qua bước duyệt ⇒ có link Hồ sơ online (kể cả khi đã kết thúc — chỉ thôi xuất / đánh dấu gửi). */
export const hasTrackingLinks = (st: CampaignStatus) =>
  st === "approved" || st === "scheduled" || st === "sending" || st === "sent" || st === "ended";

// ─── Dòng chiến dịch ─────────────────────────────────────────────────────────

export interface CampaignRow {
  id: string;
  workspaceId: string;
  name: string;
  notes: string | null;
  /** Tin trên sàn Trạm đã nhận. */
  listingIds: string[];
  /** Hồ sơ số hoá đã duyệt (từ 20261004210200). */
  postingIds: string[];
  /** Khoá "listing:id" / "posting:id" — tin trước, hồ sơ sau (thứ tự server dựng dữ kiện). */
  assetKeys: string[];
  channels: CampaignChannel[];
  status: CampaignStatus;
  facts: FactsSnapshot;
  drafts: CampaignDrafts;
  branchId: string | null;
  branchName: string | null;
  sentChannels: Partial<Record<CampaignChannel, string>>;
  createdBy: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDbRow {
  id: string;
  workspace_id: string;
  name: string;
  notes: string | null;
  listing_ids: string[];
  posting_ids?: string[] | null;
  channels: string[];
  status: string;
  facts_snapshot: unknown;
  drafts: unknown;
  branch_id: string | null;
  sent_channels: unknown;
  created_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  branch?: { display_name: string | null; asset_owner?: { name: string | null } | null } | null;
}

export function mapCampaignRow(r: CampaignDbRow): CampaignRow {
  const sent = (r.sent_channels && typeof r.sent_channels === "object" ? r.sent_channels : {}) as Record<string, unknown>;
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    name: r.name,
    notes: r.notes,
    listingIds: r.listing_ids ?? [],
    postingIds: r.posting_ids ?? [],
    assetKeys: [...(r.listing_ids ?? []).map((id) => `listing:${id}`), ...(r.posting_ids ?? []).map((id) => `posting:${id}`)],
    channels: CAMPAIGN_CHANNELS.filter((c) => (r.channels ?? []).includes(c)),
    status: campaignStatusOf(r.status),
    facts: parseFacts(r.facts_snapshot),
    drafts: parseDrafts(r.drafts),
    branchId: r.branch_id,
    branchName: r.branch?.display_name || r.branch?.asset_owner?.name || null,
    sentChannels: Object.fromEntries(
      Object.entries(sent).filter(([k, v]) => isCampaignChannel(k) && typeof v === "string"),
    ) as Partial<Record<CampaignChannel, string>>,
    createdBy: r.created_by,
    submittedBy: r.submitted_by,
    submittedAt: r.submitted_at,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    rejectedBy: r.rejected_by,
    rejectedAt: r.rejected_at,
    rejectedReason: r.rejected_reason,
    sentAt: r.sent_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── Danh sách ───────────────────────────────────────────────────────────────

export const CAMPAIGN_TABS = ["tat-ca", "nhap", "cho-duyet", "da-duyet", "da-gui"] as const;
export type CampaignTab = (typeof CAMPAIGN_TABS)[number];

export const CAMPAIGN_TAB_LABEL: Record<CampaignTab, string> = {
  "tat-ca": "Tất cả",
  nhap: "Nháp",
  "cho-duyet": "Chờ duyệt",
  "da-duyet": "Đã duyệt",
  "da-gui": "Đã gửi",
};

const TAB_STATUSES: Record<Exclude<CampaignTab, "tat-ca">, CampaignStatus[]> = {
  nhap: ["draft", "rejected"],
  "cho-duyet": ["pending_approval"],
  "da-duyet": ["approved", "scheduled", "sending"],
  "da-gui": ["sent", "ended"],
};

export const inCampaignTab = (st: CampaignStatus, tab: CampaignTab) => tab === "tat-ca" || TAB_STATUSES[tab].includes(st);

export function campaignTabCounts(rows: readonly CampaignRow[]): Record<CampaignTab, number> {
  return Object.fromEntries(CAMPAIGN_TABS.map((t) => [t, rows.filter((r) => inCampaignTab(r.status, t)).length])) as Record<
    CampaignTab,
    number
  >;
}

export const BRANCH_FILTER_ALL = "tat-ca";

const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export function filterCampaigns(
  rows: readonly CampaignRow[],
  tab: CampaignTab,
  q: string,
  branch: string,
): CampaignRow[] {
  const needle = fold(q.trim());
  return rows.filter(
    (r) =>
      inCampaignTab(r.status, tab) &&
      (branch === BRANCH_FILTER_ALL || r.branchId === branch) &&
      (!needle || [r.name, ...r.facts.assets.map((a) => a.title)].some((x) => fold(x).includes(needle))),
  );
}

// ─── Trình soạn: tiến độ ─────────────────────────────────────────────────────

export const EDITOR_SECTIONS = [
  { id: "info", label: "Thông tin" },
  { id: "assets", label: "Tài sản" },
  { id: "channels", label: "Kênh" },
  { id: "content", label: "Nội dung" },
] as const;
export type EditorSection = (typeof EDITOR_SECTIONS)[number]["id"];

export interface EditorState {
  name: string;
  /** Khoá "listing:id" / "posting:id". */
  assetKeys: readonly string[];
  channels: readonly CampaignChannel[];
  drafts: CampaignDrafts;
}

export function editorProgress(st: EditorState): { done: Record<EditorSection, boolean>; progress: number } {
  const done: Record<EditorSection, boolean> = {
    info: st.name.trim().length >= CAMPAIGN_NAME_MIN,
    assets: st.assetKeys.length > 0,
    channels: st.channels.length > 0,
    content: st.channels.length > 0 && st.channels.every((c) => channelDraftDone(st.drafts, c)),
  };
  const n = Object.values(done).filter(Boolean).length;
  return { done, progress: n / EDITOR_SECTIONS.length };
}

// ─── Duyệt hai người ─────────────────────────────────────────────────────────

/** Bản sao luật owner_mkt_checker_reason — chỉ để ẩn nút / giải thích; server mới là cổng. */
export function isSelfReview(c: Pick<CampaignRow, "createdBy" | "submittedBy">, userId: string | null, memberCount: number) {
  if (!userId || memberCount <= 1) return false;
  return c.createdBy === userId || c.submittedBy === userId;
}

// ─── Lỗi ─────────────────────────────────────────────────────────────────────

export class CampaignRpcError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "CampaignRpcError";
  }
}

const REASON_TEXT: Record<string, string> = {
  not_found: "Không tìm thấy chiến dịch (có thể đã bị xoá hoặc thuộc đơn vị khác).",
  forbidden: "Bạn không có quyền với chiến dịch này hoặc với một tài sản trong đó (kể cả phạm vi chi nhánh).",
  invalid_status: "Trạng thái chiến dịch vừa thay đổi. Tải lại trang để xem bản mới nhất.",
  mode_not_available: "Gửi email tới người mua trên sàn chưa mở — hiện chỉ dùng chế độ xuất.",
  self_approval: "Người soạn hoặc người gửi duyệt không tự duyệt được. Nhờ một người khác có quyền duyệt.",
  drafts_invalid: "Nội dung gửi lên không hợp lệ. Thông tin phiên đấu giá không sửa được trong chiến dịch.",
  drafts_too_long: "Nội dung quá dài so với giới hạn của kênh.",
  sms_not_ascii: "Nội dung SMS phải viết không dấu.",
  incomplete: "Còn kênh chưa có nội dung (Email cần cả tiêu đề).",
  no_channel: "Chọn ít nhất một kênh.",
  name_invalid: `Tên chiến dịch cần từ ${CAMPAIGN_NAME_MIN} đến ${CAMPAIGN_NAME_MAX} ký tự.`,
  notes_too_long: `Ghi chú tối đa ${CAMPAIGN_NOTES_MAX} ký tự.`,
  note_too_long: "Ghi chú tối đa 500 ký tự.",
  listings_invalid: `Chọn từ 1 đến ${CAMPAIGN_MAX_ASSETS} tài sản.`,
  listing_not_in_workspace: "Có tài sản không còn thuộc đơn vị. Bỏ tài sản đó khỏi chiến dịch rồi thử lại.",
  posting_not_available: "Có hồ sơ số hoá đã huỷ hoặc đang chờ sàn duyệt lại. Bỏ hồ sơ đó khỏi chiến dịch rồi thử lại.",
  channel_invalid: "Kênh không thuộc chiến dịch.",
  already_marked: "Kênh này đã được đánh dấu đã gửi.",
  reason_required: `Nhập lý do từ chối (${REJECT_REASON_MIN}–${REJECT_REASON_MAX} ký tự).`,
  kind_invalid: "Loại tư liệu không hợp lệ.",
};

export function campaignErrorMessage(err: unknown): string {
  if (err instanceof CampaignRpcError) return REASON_TEXT[err.reason] ?? "Thao tác không thành công.";
  const msg = ((err ?? {}) as { message?: string }).message ?? "";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Mất kết nối mạng. Vui lòng thử lại.";
  return "Có lỗi xảy ra. Vui lòng thử lại.";
}

/** RPC trả {ok, reason, …} — ok:false ⇒ ném lỗi nghiệp vụ. */
export function unwrapRpc<T extends Record<string, unknown>>(data: unknown): T {
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.ok !== true) throw new CampaignRpcError(typeof d.reason === "string" ? d.reason : "unknown");
  return d as T;
}

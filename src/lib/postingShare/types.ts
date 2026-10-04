// Hồ sơ online — link công khai /hs/:code (docs/owner-marketing-plan.md Phase M0, migration
// 20261001100000). Từ 20261004210000 MỌI link chia sẻ của chủ tài sản là link Hồ sơ online,
// trỏ tới hồ sơ số hoá HOẶC tin trên sàn Trạm đã nhận (kể cả link chiến dịch, link /l/ cũ).
//
// Thuần (không React/Supabase) để test được. Payload công khai là DANH SÁCH TRẮNG ở server
// (posting_share_public_keys): không giấy tờ, không cam kết sở hữu, không id, không bộ đếm.
// Mã link chỉ về tay người có so-hoa:share (cột code không cấp SELECT).

import { parentOf } from "@/lib/reports/listingsReport";

// ─── Kiểu ────────────────────────────────────────────────────────────────────

/** Đích của link: hồ sơ số hoá hoặc tin trên sàn. */
export type ShareTargetKind = "posting" | "listing";

/** Tài sản cần tạo link — hồ sơ (cá nhân hoặc của Trạm) hoặc tin Trạm đã nhận. */
export type ShareTarget =
  | { kind: "posting"; postingId: string; workspaceId: string | null }
  | { kind: "listing"; listingId: string; workspaceId: string };

export const shareTargetId = (t: ShareTarget) => (t.kind === "posting" ? t.postingId : t.listingId);

export interface SharedPostingSession {
  /** Đường dẫn trang phiên công khai, vd. "/sessions/<id>". */
  path: string;
  code: string | null;
  title: string;
  lotNo: number | null;
  organizationName: string | null;
  organizationLogoUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  dossierFee: number | null;
  depositAmount: number | null;
  startingPrice: number | null;
}

export interface SharedPostingLegal {
  hasDispute: boolean | null;
  hasMortgage: boolean | null;
  isSeized: boolean | null;
  rightToSell: boolean | null;
}

export interface SharedPosting {
  /** "listing" = tin trên sàn: không mô tả / pháp lý tự khai; "Theo dõi" là Lưu tài sản. */
  kind: ShareTargetKind;
  /** Trang tin trên sàn (/listings/:id) — chỉ với tin. */
  listingPath: string | null;
  title: string;
  category: { parent: string; child: string };
  location: { province: string | null; district: string | null; ward: string | null; address: string | null };
  description: string | null;
  specs: Record<string, unknown>;
  legal: SharedPostingLegal;
  imageUrls: string[];
  videoUrls: string[];
  model3d: { url: string; posterUrl: string | null; format: string | null } | null;
  vrUrl: string | null;
  authenticated: boolean;
  /** null = ẩn ("Giá khởi điểm: liên hệ") — server chỉ trả khi link cho phép hoặc đã có phiên công bố. */
  startingPrice: number | null;
  session: SharedPostingSession | null;
  /** Tên đơn vị (ngân hàng / AMC); hồ sơ cá nhân: null. */
  ownerName: string | null;
  sender: { name: string | null; phone: string | null } | null;
  expiresAt: string | null;
}

export type SharedPostingUnavailable = "not_found" | "expired" | "unavailable";

export type SharedPostingResult =
  /** `ref` = id link khi lượt mở được tính (người ngoài) — để ghi cookie ghi nhận nguồn. */
  | { ok: true; posting: SharedPosting; ref: string | null }
  | { ok: false; reason: SharedPostingUnavailable; expiredAt: string | null };

export interface PostingShareLink {
  id: string;
  /** null khi người xem không có quyền chia sẻ (chỉ thấy số liệu). */
  code: string | null;
  label: string;
  /** Thành viên gửi link; null = link cũ gõ tay hoặc chưa chọn. */
  senderUserId: string | null;
  /** Tên / SĐT hiện tại trong hồ sơ người gửi (link cũ: bản ghi lúc tạo). */
  senderName: string | null;
  senderPhone: string | null;
  showPrice: boolean;
  showExactAddress: boolean;
  showSenderContact: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  uniqueViewCount: number;
  ctaDossierCount: number;
  ctaPdfCount: number;
  ctaFollowCount: number;
  ctaCallCount: number;
  lastViewedAt: string | null;
  createdByName: string | null;
  createdAt: string;
  postingId: string | null;
  listingId: string | null;
  workspaceId: string | null;
  branchId: string | null;
  branchName: string | null;
  channel: string;
  campaignId: string | null;
  campaignName: string | null;
  targetKind: ShareTargetKind;
  targetTitle: string;
  /** Mã hồ sơ (HS-0001) hoặc 8 ký tự đầu id tin. */
  targetCode: string | null;
  targetImage: string | null;
  /** Chuyển từ link theo dõi /l/ cũ. */
  isLegacy: boolean;
  /** Có từ RPC tổng hợp / chi tiết; null khi RPC không trả (danh sách theo hồ sơ dùng canShare). */
  canManage: boolean | null;
}

export interface PostingShareLinks {
  canShare: boolean;
  links: PostingShareLink[];
}

/** Người được chọn làm người gửi: thành viên Trạm (hồ sơ cá nhân: chính chủ hồ sơ). */
export interface ShareSender {
  userId: string;
  name: string | null;
  email: string;
  /** null = hồ sơ thành viên chưa có SĐT (bổ sung ở trang Thành viên). */
  phone: string | null;
  roleName: string | null;
}

/** Nội dung form tạo / sửa link. expiresInDays null = không hết hạn. */
export interface ShareLinkInput {
  label: string;
  /** Kênh gửi (MKT_CHANNELS) — để so sánh kênh nào mang khách về. */
  channel: string;
  /** Tên + SĐT do server lấy từ hồ sơ thành viên — client không gửi. */
  senderUserId: string | null;
  showPrice: boolean;
  showExactAddress: boolean;
  showSenderContact: boolean;
  expiresInDays: number | null;
}

export type ShareEvent = "cta_dossier" | "cta_pdf" | "cta_follow" | "cta_call";

// ─── Đọc JSON từ RPC ─────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown): number => num(v) ?? 0;
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function mapSession(v: unknown): SharedPostingSession | null {
  const s = obj(v);
  const path = str(s.path);
  if (!path) return null;
  return {
    path,
    code: str(s.code),
    title: str(s.title) ?? "",
    lotNo: num(s.lot_no),
    organizationName: str(s.organization_name),
    organizationLogoUrl: str(s.organization_logo_url),
    startsAt: str(s.starts_at),
    endsAt: str(s.ends_at),
    registrationStartAt: str(s.registration_start_at),
    registrationEndAt: str(s.registration_end_at),
    dossierFee: num(s.dossier_fee),
    depositAmount: num(s.deposit_amount),
    startingPrice: num(s.starting_price),
  };
}

export function mapSharedPosting(v: unknown): SharedPosting {
  const p = obj(v);
  const category = obj(p.category);
  const kind: ShareTargetKind = p.kind === "listing" ? "listing" : "posting";
  const child = str(category.child) ?? "";
  const location = obj(p.location);
  const legal = obj(p.legal);
  const model = obj(p.model_3d);
  const sender = p.sender ? obj(p.sender) : null;
  return {
    kind,
    listingPath: kind === "listing" ? str(p.listing_path) : null,
    title: str(p.title) ?? "",
    // Tin: server không có cây danh mục ⇒ suy nhóm cha ở đây.
    category: { parent: str(category.parent) ?? (child ? parentOf(child) : ""), child },
    location: {
      province: str(location.province),
      district: str(location.district),
      ward: str(location.ward),
      address: str(location.address),
    },
    description: str(p.description),
    specs: obj(p.specs),
    legal: {
      hasDispute: bool(legal.has_dispute),
      hasMortgage: bool(legal.has_mortgage),
      isSeized: bool(legal.is_seized),
      rightToSell: bool(legal.right_to_sell),
    },
    imageUrls: strings(p.image_urls),
    videoUrls: strings(p.video_urls),
    model3d: str(model.url) ? { url: str(model.url)!, posterUrl: str(model.poster_url), format: str(model.format) } : null,
    vrUrl: str(p.vr_url),
    authenticated: p.authenticated === true,
    startingPrice: num(p.starting_price),
    session: mapSession(p.session),
    ownerName: str(p.owner_name),
    sender: sender ? { name: str(sender.name), phone: str(sender.phone) } : null,
    expiresAt: str(p.expires_at),
  };
}

const UNAVAILABLE: readonly SharedPostingUnavailable[] = ["not_found", "expired", "unavailable"];

export function mapSharedPostingResponse(v: unknown): SharedPostingResult {
  const d = obj(v);
  if (d.ok === true) return { ok: true, posting: mapSharedPosting(d.posting), ref: str(d.ref) };
  const reason = UNAVAILABLE.includes(d.reason as SharedPostingUnavailable)
    ? (d.reason as SharedPostingUnavailable)
    : "not_found";
  return { ok: false, reason, expiredAt: str(d.expired_at) };
}

export function mapShareLink(v: unknown): PostingShareLink {
  const l = obj(v);
  return {
    id: str(l.id) ?? "",
    code: str(l.code),
    label: str(l.label) ?? "",
    senderUserId: str(l.sender_user_id),
    senderName: str(l.sender_name),
    senderPhone: str(l.sender_phone),
    showPrice: l.show_price === true,
    showExactAddress: l.show_exact_address === true,
    showSenderContact: l.show_sender_contact === true,
    expiresAt: str(l.expires_at),
    revokedAt: str(l.revoked_at),
    viewCount: int(l.view_count),
    uniqueViewCount: int(l.unique_view_count),
    ctaDossierCount: int(l.cta_dossier_count),
    ctaPdfCount: int(l.cta_pdf_count),
    ctaFollowCount: int(l.cta_follow_count),
    ctaCallCount: int(l.cta_call_count),
    lastViewedAt: str(l.last_viewed_at),
    createdByName: str(l.created_by_name),
    createdAt: str(l.created_at) ?? "",
    postingId: str(l.posting_id),
    listingId: str(l.listing_id),
    workspaceId: str(l.workspace_id),
    branchId: str(l.branch_id),
    branchName: str(l.branch_name),
    channel: str(l.channel) ?? "other",
    campaignId: str(l.campaign_id),
    campaignName: str(l.campaign_name),
    targetKind: l.target_kind === "listing" ? "listing" : "posting",
    targetTitle: str(l.target_title) ?? "Tài sản",
    targetCode: str(l.target_code),
    targetImage: str(l.target_image),
    isLegacy: l.is_legacy === true,
    canManage: typeof l.can_manage === "boolean" ? l.can_manage : null,
  };
}

/** Đích của một link đã có (để mở lại form tạo link cho cùng tài sản). */
export function shareTargetOf(l: PostingShareLink): ShareTarget | null {
  if (l.postingId) return { kind: "posting", postingId: l.postingId, workspaceId: l.workspaceId };
  if (l.listingId && l.workspaceId) return { kind: "listing", listingId: l.listingId, workspaceId: l.workspaceId };
  return null;
}

export function mapShareSenders(v: unknown): ShareSender[] {
  const d = obj(v);
  return (Array.isArray(d.senders) ? d.senders : []).map((x) => {
    const s = obj(x);
    return {
      userId: str(s.user_id) ?? "",
      name: str(s.name),
      email: str(s.email) ?? "",
      phone: str(s.phone),
      roleName: str(s.role_name),
    };
  });
}

export function mapShareLinks(v: unknown): PostingShareLinks {
  const d = obj(v);
  return {
    canShare: d.can_share === true,
    links: Array.isArray(d.links) ? d.links.map(mapShareLink) : [],
  };
}

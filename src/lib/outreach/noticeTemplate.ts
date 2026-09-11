// MẪU THÔNG BÁO ĐẤU GIÁ TÀI SẢN — câu chữ KHOÁ theo phiên bản.
//
// Cùng cách làm với ASSET_DECLARATION_CLAUSES (src/constants/terms.ts): văn bản
// nằm NGAY CẠNH số phiên bản; gói tiếp thị chỉ lưu `notice_template_version`.
//
// LUẬT KHOÁ:
//  • heading / clause / nhãn field là câu chữ cố định — không component nào,
//    không trình soạn nào được sửa. Sửa bất kỳ ký tự nào ⇒ thêm PHIÊN BẢN MỚI vào
//    NOTICE_TEMPLATES (giữ bản cũ để gói đã tạo vẫn dựng lại được) và cập nhật
//    PUBLISHED_TEMPLATE_HASHES. noticeTemplate.test.ts khoá hash từng phiên bản.
//  • Ô (slot) có 3 nguồn:
//      fact  — dựng TRỰC TIẾP từ phiên/lô/tổ chức, chỉ đọc, không lưu vào gói;
//      case  — tổ chức tự khai trong hồ sơ vụ việc (người có tài sản, giấy tờ…),
//              trình soạn KHÔNG điền;
//      draft — ô mô tả duy nhất trình soạn được điền, người dùng sửa được.
//
// CẢNH BÁO: nội dung mẫu bám các nội dung thông báo công khai theo Luật Đấu giá
// tài sản 2016 (sửa đổi 2024) nhưng CHƯA được pháp chế rà soát — reviewStatus
// 'pending_legal_review' hiện banner cảnh báo trên UI.

export type NoticeSlotSource = "fact" | "case" | "draft";

export const FACT_SLOTS = {
  org_name: "Tên tổ chức hành nghề đấu giá",
  org_address: "Địa chỉ tổ chức",
  org_phone: "Điện thoại tổ chức",
  lots_list: "Danh mục tài sản",
  starting_prices: "Giá khởi điểm",
  deposits: "Tiền đặt trước",
  bid_steps: "Bước giá",
  viewing_time: "Thời gian xem tài sản",
  registration_time: "Thời gian bán, tiếp nhận hồ sơ",
  dossier_fee: "Tiền mua hồ sơ",
  auction_time: "Thời gian tổ chức cuộc đấu giá",
  auction_venue: "Địa điểm tổ chức cuộc đấu giá",
  auction_format: "Hình thức đấu giá",
  public_url: "Trang phiên trên sàn",
} as const;

export const CASE_SLOTS = {
  owner_info: { label: "Người có tài sản đấu giá", hint: "Tên, địa chỉ theo hợp đồng dịch vụ đấu giá" },
  asset_location: { label: "Nơi có tài sản", hint: "Địa chỉ nơi đặt / lưu giữ tài sản" },
  ownership_papers: { label: "Giấy tờ về quyền sở hữu, quyền sử dụng", hint: "Số, ngày cấp, cơ quan cấp" },
  viewing_place: { label: "Địa điểm xem tài sản", hint: "" },
  registration_place: { label: "Địa điểm bán, tiếp nhận hồ sơ", hint: "Thường là trụ sở tổ chức" },
  registration_conditions: { label: "Điều kiện, cách thức đăng ký tham gia", hint: "Đối tượng được tham gia, giấy tờ cần nộp" },
  auction_method: { label: "Phương thức đấu giá", hint: "VD: phương thức trả giá lên" },
  contact_person: { label: "Người liên hệ", hint: "Họ tên, số điện thoại" },
} as const;

export const DRAFT_SLOTS = {
  asset_description: { label: "Mô tả tài sản (số lượng, chất lượng)" },
  asset_condition: { label: "Hiện trạng tài sản" },
} as const;

export type FactSlotKey = keyof typeof FACT_SLOTS;
export type CaseSlotKey = keyof typeof CASE_SLOTS;
export type DraftSlotKey = keyof typeof DRAFT_SLOTS;
export const DRAFT_SLOT_KEYS = Object.keys(DRAFT_SLOTS) as DraftSlotKey[];
export const CASE_SLOT_KEYS = Object.keys(CASE_SLOTS) as CaseSlotKey[];

export interface NoticeSlotRef {
  source: NoticeSlotSource;
  key: string;
  required: boolean;
}

export type NoticeBlock =
  | { kind: "heading"; text: string }
  | { kind: "clause"; text: string }
  | { kind: "field"; label: string; slots: NoticeSlotRef[] };

export interface NoticeTemplate {
  version: string;
  title: string;
  reviewStatus: "pending_legal_review" | "reviewed";
  blocks: readonly NoticeBlock[];
}

const slot = (source: NoticeSlotSource, key: string, required = true): NoticeSlotRef => ({ source, key, required });

export const NOTICE_TEMPLATE_VERSION = "2026-09-12";

export const NOTICE_TEMPLATES: Record<string, NoticeTemplate> = {
  "2026-09-12": {
    version: "2026-09-12",
    title: "Thông báo đấu giá tài sản",
    reviewStatus: "pending_legal_review",
    blocks: [
      { kind: "heading", text: "THÔNG BÁO ĐẤU GIÁ TÀI SẢN" },
      {
        kind: "clause",
        text:
          "Căn cứ Luật Đấu giá tài sản số 01/2016/QH14 được sửa đổi, bổ sung bởi Luật số 37/2024/QH15 và hợp đồng dịch vụ đấu giá tài sản đã ký kết, tổ chức hành nghề đấu giá tài sản thông báo việc đấu giá tài sản như sau:",
      },
      { kind: "field", label: "1. Tổ chức hành nghề đấu giá tài sản", slots: [slot("fact", "org_name"), slot("fact", "org_address", false)] },
      { kind: "field", label: "2. Người có tài sản đấu giá", slots: [slot("case", "owner_info")] },
      {
        kind: "field",
        label: "3. Tên tài sản, số lượng, chất lượng của tài sản đấu giá",
        slots: [slot("fact", "lots_list"), slot("draft", "asset_description")],
      },
      { kind: "field", label: "4. Hiện trạng tài sản", slots: [slot("draft", "asset_condition", false)] },
      { kind: "field", label: "5. Nơi có tài sản đấu giá", slots: [slot("case", "asset_location")] },
      { kind: "field", label: "6. Giấy tờ về quyền sở hữu, quyền sử dụng tài sản đấu giá", slots: [slot("case", "ownership_papers")] },
      { kind: "field", label: "7. Giá khởi điểm", slots: [slot("fact", "starting_prices")] },
      { kind: "field", label: "8. Tiền đặt trước", slots: [slot("fact", "deposits")] },
      { kind: "field", label: "9. Bước giá", slots: [slot("fact", "bid_steps", false)] },
      { kind: "field", label: "10. Thời gian, địa điểm xem tài sản", slots: [slot("fact", "viewing_time"), slot("case", "viewing_place")] },
      {
        kind: "field",
        label: "11. Thời gian, địa điểm bán và tiếp nhận hồ sơ tham gia đấu giá",
        slots: [slot("fact", "registration_time"), slot("case", "registration_place")],
      },
      { kind: "field", label: "12. Tiền mua hồ sơ tham gia đấu giá", slots: [slot("fact", "dossier_fee", false)] },
      { kind: "field", label: "13. Điều kiện, cách thức đăng ký tham gia đấu giá", slots: [slot("case", "registration_conditions")] },
      {
        kind: "field",
        label: "14. Thời gian, địa điểm tổ chức cuộc đấu giá",
        slots: [slot("fact", "auction_time"), slot("fact", "auction_venue")],
      },
      {
        kind: "field",
        label: "15. Hình thức đấu giá, phương thức đấu giá",
        slots: [slot("fact", "auction_format"), slot("case", "auction_method")],
      },
      {
        kind: "clause",
        text:
          "Tổ chức, cá nhân có nhu cầu tham gia đấu giá liên hệ tổ chức hành nghề đấu giá tài sản nêu trên để được hướng dẫn chi tiết.",
      },
      {
        kind: "field",
        label: "Liên hệ",
        slots: [slot("fact", "org_phone", false), slot("case", "contact_person", false), slot("fact", "public_url", false)],
      },
    ],
  },
};

/** Hash câu chữ của từng phiên bản đã phát hành — xem luật khoá ở đầu file. */
export const PUBLISHED_TEMPLATE_HASHES: Record<string, string> = {
  "2026-09-12": "df3ecc64",
};

export function noticeTemplate(version?: string | null): NoticeTemplate {
  return (version && NOTICE_TEMPLATES[version]) || NOTICE_TEMPLATES[NOTICE_TEMPLATE_VERSION];
}

/** Mọi câu chữ khoá của một mẫu (tiêu đề, điều khoản, nhãn mục). */
export function lockedTexts(t: NoticeTemplate): string[] {
  return t.blocks.map((b) => (b.kind === "field" ? b.label : b.text));
}

export function slotLabel(source: NoticeSlotSource, key: string): string {
  if (source === "fact") return FACT_SLOTS[key as FactSlotKey] ?? key;
  if (source === "case") return CASE_SLOTS[key as CaseSlotKey]?.label ?? key;
  return DRAFT_SLOTS[key as DraftSlotKey]?.label ?? key;
}

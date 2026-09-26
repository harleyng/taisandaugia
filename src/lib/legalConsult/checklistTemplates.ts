import { ASSET_CATEGORIES } from "@/constants/category.constants";

// Mẫu checklist tư vấn pháp lý theo nhóm tài sản cấp 1 — chuyên gia nạp mẫu rồi chấm
// Đủ / Thiếu / Cần làm rõ, thêm / bớt mục tuỳ hồ sơ. Hard-code như PROOF_MODE
// (asset-posting-rules.ts): đổi mẫu KHÔNG ảnh hưởng checklist đã lưu, vì mỗi lần tư vấn
// chụp lại nhãn mục vào asset_legal_consultation_items.
//
// `key` được lưu vào template_key — đừng đổi key của mục đã dùng, chỉ thêm key mới.

export interface ChecklistTemplateItem {
  key: string;
  label: string;
}

type AssetParentSlug = (typeof ASSET_CATEGORIES)[number]["slug"];

const OWNER_IDENTITY: ChecklistTemplateItem = {
  key: "owner_identity",
  label: "Giấy tờ nhân thân / pháp nhân của chủ sở hữu (CCCD, ĐKKD)",
};
const AUTHORIZATION: ChecklistTemplateItem = {
  key: "authorization",
  label: "Văn bản uỷ quyền bán (nếu người bán không phải chủ sở hữu)",
};
const NO_DISPUTE: ChecklistTemplateItem = {
  key: "no_dispute",
  label: "Tài sản không tranh chấp, không bị kê biên / hạn chế giao dịch",
};
const ORIGIN_DOCS: ChecklistTemplateItem = {
  key: "origin_docs",
  label: "Chứng từ nguồn gốc (hoá đơn, hợp đồng mua bán, tờ khai nhập khẩu)",
};

const TEMPLATES: Record<AssetParentSlug, ChecklistTemplateItem[]> = {
  "bat-dong-san": [
    { key: "land_certificate", label: "Giấy chứng nhận QSDĐ / quyền sở hữu nhà (sổ đỏ / sổ hồng)" },
    OWNER_IDENTITY,
    { key: "co_owner_consent", label: "Văn bản đồng ý của đồng sở hữu / vợ chồng" },
    { key: "mortgage_release", label: "Xác nhận không thế chấp hoặc đã giải chấp" },
    { key: "construction_permit", label: "Giấy phép xây dựng / hoàn công (nếu có công trình)" },
    { key: "planning_info", label: "Thông tin quy hoạch, không thuộc diện thu hồi" },
    { key: "land_tax", label: "Chứng từ hoàn thành nghĩa vụ tài chính về đất" },
    NO_DISPUTE,
    AUTHORIZATION,
  ],
  "xe-co": [
    { key: "vehicle_registration", label: "Giấy đăng ký xe (cà-vẹt) bản gốc" },
    { key: "inspection", label: "Giấy chứng nhận kiểm định còn hiệu lực" },
    OWNER_IDENTITY,
    { key: "vehicle_mortgage", label: "Xác nhận không thế chấp hoặc đã giải chấp" },
    { key: "traffic_violations", label: "Không có vi phạm giao thông chưa xử lý" },
    ORIGIN_DOCS,
    AUTHORIZATION,
  ],
  "may-moc": [
    ORIGIN_DOCS,
    OWNER_IDENTITY,
    { key: "technical_docs", label: "Hồ sơ kỹ thuật / kiểm định an toàn (nếu thuộc diện phải kiểm định)" },
    { key: "asset_mortgage", label: "Không là tài sản bảo đảm / đã giải chấp" },
    NO_DISPUTE,
    AUTHORIZATION,
  ],
  "hang-hoa": [
    ORIGIN_DOCS,
    OWNER_IDENTITY,
    { key: "quality_cert", label: "Chứng nhận chất lượng / hợp quy (nếu thuộc diện bắt buộc)" },
    { key: "trade_restrictions", label: "Không thuộc hàng cấm / hạn chế kinh doanh" },
    NO_DISPUTE,
    AUTHORIZATION,
  ],
  "do-dung": [ORIGIN_DOCS, OWNER_IDENTITY, NO_DISPUTE, AUTHORIZATION],
  "thu-cong-my-nghe": [
    ORIGIN_DOCS,
    OWNER_IDENTITY,
    { key: "ownership_declaration", label: "Bản cam kết quyền sở hữu hợp lệ" },
    NO_DISPUTE,
    AUTHORIZATION,
  ],
  "co-vat-suu-tam": [
    { key: "provenance", label: "Hồ sơ nguồn gốc, quá trình sở hữu cổ vật" },
    { key: "heritage_registration", label: "Đăng ký cổ vật / xác nhận không phải bảo vật quốc gia" },
    { key: "authentication_cert", label: "Chứng thư giám định (nếu có)" },
    OWNER_IDENTITY,
    NO_DISPUTE,
    AUTHORIZATION,
  ],
  khac: [ORIGIN_DOCS, OWNER_IDENTITY, NO_DISPUTE, AUTHORIZATION],
};

const DEFAULT_TEMPLATE: ChecklistTemplateItem[] = [ORIGIN_DOCS, OWNER_IDENTITY, NO_DISPUTE, AUTHORIZATION];

export const templateFor = (parentSlug: string | null | undefined): ChecklistTemplateItem[] =>
  (parentSlug ? TEMPLATES[parentSlug as AssetParentSlug] : undefined) ?? DEFAULT_TEMPLATE;

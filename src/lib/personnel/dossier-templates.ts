// Danh mục MẪU và MỤC của bản xuất hồ sơ đấu giá viên.
//
// Nguồn sự thật dùng chung cho cả popup chọn (DossierExportWizard) lẫn renderer
// PDF (dossier-pdf/). Nhãn và mô tả nằm ở đây, KHÔNG nằm trong renderer — sửa
// tên mẫu mà phải mở file dựng PDF là sai chỗ.

/**
 * Ba phong cách trình bày. `FULL` giữ nguyên key cũ: mọi bản đã xuất trong
 * `personnel_dossier_exports` đều mang giá trị này, đổi key là phải migrate
 * dữ liệu người dùng đã trả credit để tạo ra.
 */
export type DossierTemplate = 'FULL' | 'FORMAL' | 'COMPACT'

/** Mục nội dung bật/tắt được. Hero (ảnh, họ tên, số thẻ) LUÔN in — bỏ nó thì
 *  file không còn là hồ sơ của ai nữa. */
export type DossierSectionId =
  | 'strengths'
  | 'education'
  | 'notable'
  | 'cpd'
  | 'rewards'
  | 'identity'
  | 'practice'
  | 'annex'

export const TEMPLATE_ORDER: DossierTemplate[] = ['FULL', 'FORMAL', 'COMPACT']

export const TEMPLATE_LABELS: Record<DossierTemplate, string> = {
  FULL: 'Năng lực',
  FORMAL: 'Hành chính',
  COMPACT: 'Tối giản',
}

export const TEMPLATE_DESCRIPTIONS: Record<DossierTemplate, string> = {
  FULL: 'Hero màu, ảnh chân dung và dải chỉ số — bản để nộp thầu hoặc giới thiệu năng lực.',
  FORMAL: 'Trang trọng, mục đánh số La Mã, bảng kẻ viền — in đen trắng vẫn đọc đủ.',
  COMPACT: 'Gọn, không nền màu, dồn chỉ số thành một dòng — bản gửi nhanh cho khách.',
}

export const TEMPLATE_PAGE_HINT: Record<DossierTemplate, string> = {
  FULL: '3 trang A4',
  FORMAL: '2–3 trang A4',
  COMPACT: '1–2 trang A4',
}

/** Thứ tự in CỐ ĐỊNH — không theo thứ tự người dùng tick. */
export const SECTION_ORDER: DossierSectionId[] = [
  'strengths', 'education', 'notable', 'cpd', 'rewards', 'identity', 'practice', 'annex',
]

export const SECTION_LABELS: Record<DossierSectionId, string> = {
  strengths: 'Sở trường tài sản',
  education: 'Đào tạo',
  notable: 'Cuộc đấu giá tiêu biểu',
  cpd: 'Bồi dưỡng nghiệp vụ',
  rewards: 'Khen thưởng',
  identity: 'Thông tin định danh',
  practice: 'Thông tin hành nghề',
  annex: 'Phụ lục bản chụp',
}

export const SECTION_HINTS: Record<DossierSectionId, string> = {
  strengths: 'Nhóm tài sản đã điều hành nhiều nhất',
  education: 'Trình độ, chuyên ngành, cơ sở đào tạo',
  notable: 'Bốn cuộc chênh lệch cao nhất so giá khởi điểm',
  cpd: 'Khoá bồi dưỡng và kết luận tuân thủ theo năm',
  rewards: 'Chỉ khen thưởng — kỷ luật không đưa vào bản xuất',
  identity: 'Ngày sinh, quê quán, CCCD/hộ chiếu, liên hệ',
  practice: 'Thẻ ĐGV, CCHN, chức vụ, hợp đồng',
  annex: 'Ảnh chụp giấy tờ hành nghề, mỗi giấy một ô',
}

/** Bộ mục bật sẵn khi chọn mẫu. Đổi mẫu là đặt lại theo bộ này. */
export const DEFAULT_SECTIONS: Record<DossierTemplate, DossierSectionId[]> = {
  FULL: [...SECTION_ORDER],
  FORMAL: [...SECTION_ORDER],
  // Bản tối giản để gửi nhanh: phụ lục scan làm file phồng lên vài trang.
  COMPACT: SECTION_ORDER.filter((s) => s !== 'annex'),
}

export interface DossierExportOptions {
  template: DossierTemplate
  sections: DossierSectionId[]
}

export const DEFAULT_EXPORT_OPTIONS: DossierExportOptions = {
  template: 'FULL',
  sections: [...DEFAULT_SECTIONS.FULL],
}

/** Lọc + sắp lại theo SECTION_ORDER, bỏ giá trị lạ (dữ liệu cũ trong DB). */
export function normalizeSections(ids: readonly string[]): DossierSectionId[] {
  return SECTION_ORDER.filter((s) => ids.includes(s))
}

import { Application } from '@/types/application'

export interface ValidationError {
  section: string
  message: string
}

export function validateForExport(app: Application): ValidationError[] {
  const errors: ValidationError[] = []

  // Section 1: required fields
  const a = app.announcement
  if (!a.ownerName.trim()) errors.push({ section: 'Section 1', message: 'Thiếu tên người có tài sản' })
  if (!a.assetDescription.trim()) errors.push({ section: 'Section 1', message: 'Thiếu mô tả tài sản' })
  if (!a.assetCategory) errors.push({ section: 'Section 1', message: 'Chưa chọn loại tài sản' })
  if (a.startingPrice === '' || Number(a.startingPrice) <= 0)
    errors.push({ section: 'Section 1', message: 'Thiếu giá khởi điểm' })
  if (!a.province) errors.push({ section: 'Section 1', message: 'Chưa chọn tỉnh/thành' })
  if (!a.deadline) errors.push({ section: 'Section 1', message: 'Thiếu hạn nộp hồ sơ' })

  // Section 3: each subsection must have content
  const p = app.auctionPlan
  if (!p.format.trim()) errors.push({ section: 'Mục III.1', message: 'Chưa điền hình thức, bước giá, số vòng' })
  if (!p.receptionPlan.trim()) errors.push({ section: 'Mục III.2', message: 'Chưa điền phương án bán/tiếp nhận hồ sơ' })
  if (!p.participantConditions.trim())
    errors.push({ section: 'Mục III.3', message: 'Chưa điền đối tượng, điều kiện tham gia' })
  if (!p.antiCollusionMeasures.trim())
    errors.push({ section: 'Mục III.4', message: 'Chưa điền giải pháp giám sát, chống thông đồng' })

  // Section 4: no unresolved criteria
  const unresolvedCount = app.sectionVCriteria.filter((c) => c.meets === null).length
  if (unresolvedCount > 0)
    errors.push({
      section: 'Mục V',
      message: `Còn ${unresolvedCount} tiêu chí chưa xác định đáp ứng/không`,
    })

  // Section 5: format must be chosen
  if (!app.exportFormat) errors.push({ section: 'Section 5', message: 'Chưa chọn format xuất file' })

  return errors
}

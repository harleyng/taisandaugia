import { CriterionNature, ExportFormat } from '@/types/application'

const CAPACITY_KEYWORDS = [
  'kinh nghiệm', 'đã từng', 'đã đấu giá', 'đã tổ chức',
  'có chứng chỉ', 'có giấy phép', 'là thành viên',
  'trụ sở', 'chi nhánh', 'văn phòng', 'tại',
  'năm hoạt động', 'từ năm',
  'số lượng', 'tổng số',
]

const PROPOSAL_KEYWORDS = [
  'cam kết', 'sẽ', 'đề xuất', 'phương án',
  'bảo lãnh', 'bảo đảm', 'đảm bảo',
  'thực hiện', 'hoàn thành trong',
  'kế hoạch', 'lộ trình',
]

export function classifyCriterion(label: string): CriterionNature {
  const lower = label.toLowerCase()
  const capScore = CAPACITY_KEYWORDS.filter((k) => lower.includes(k)).length
  const propScore = PROPOSAL_KEYWORDS.filter((k) => lower.includes(k)).length
  return propScore > capScore ? 'PROPOSAL' : 'CAPACITY'
}

export function detectExportFormat(text: string): ExportFormat | null {
  const lower = text.toLowerCase()

  const separatedPatterns = [
    'hồ sơ năng lực (đóng quyển)',
    'phương án đấu giá (đóng quyển)',
    'đóng quyển riêng',
    'gồm 03 quyển',
    'gồm 3 quyển',
  ]

  const integratedPatterns = [
    'theo thứ tự phụ lục i',
    'theo thứ tự các tiêu chí',
    'đóng thành một quyển',
    'bố cục trình bày nội dung',
    'một bộ hồ sơ',
  ]

  const sepScore = separatedPatterns.filter((p) => lower.includes(p)).length
  const intScore = integratedPatterns.filter((p) => lower.includes(p)).length

  if (sepScore > intScore) return 'SEPARATED'
  if (intScore > sepScore) return 'INTEGRATED'
  return null
}

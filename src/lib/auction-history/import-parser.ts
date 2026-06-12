import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import type { AssetCategory, AuctionFormat, BiddingMethod } from '@/types/auction-record'
import { classifyAsset } from './classify'

export interface ParsedRow {
  auctionDate?: string
  auctionNumber?: string
  assetDescription?: string
  assetCategory?: AssetCategory
  assetLocation?: string
  ownerName?: string
  contractNumber?: string
  contractSignedDate?: string
  startingPrice?: number
  winningPrice?: number
  isSuccessful?: boolean
  failureReason?: string
  auctionFormat?: AuctionFormat
  biddingMethod?: BiddingMethod
  bidStep?: number
  maxRounds?: number
  actualRounds?: number
  numberOfParticipants?: number
  depositPercentage?: number
  internalNotes?: string
  assetIndex?: number
  [key: string]: unknown
}

export type ColumnKey = keyof ParsedRow

export type ColumnMapping = Partial<Record<ColumnKey, string>>

export interface ValidationResult {
  validRows: ParsedRow[]
  warningRows: Array<{ row: number; data: ParsedRow; warnings: string[] }>
  errorRows: Array<{ row: number; rawData: Record<string, unknown>; errors: string[] }>
  duplicateRows: number[]
  headers: string[]
}

const HEADER_ALIASES: Record<string, ColumnKey> = {
  'ngày đấu giá': 'auctionDate',
  'ngay dau gia': 'auctionDate',
  'ngày tổ chức': 'auctionDate',
  'số phiên': 'auctionNumber',
  'mô tả tài sản': 'assetDescription',
  'mo ta tai san': 'assetDescription',
  'tài sản': 'assetDescription',
  'mô tả': 'assetDescription',
  'loại tài sản': 'assetCategory',
  'địa chỉ tài sản': 'assetLocation',
  'địa điểm': 'assetLocation',
  'người có tài sản': 'ownerName',
  'nguoi co tai san': 'ownerName',
  'chủ tài sản': 'ownerName',
  'số hợp đồng': 'contractNumber',
  'giá khởi điểm': 'startingPrice',
  'gia khoi diem': 'startingPrice',
  'giá khởi điểm (vnd)': 'startingPrice',
  'giá trúng': 'winningPrice',
  'gia trung': 'winningPrice',
  'giá trúng (vnd)': 'winningPrice',
  'trạng thái': 'isSuccessful',
  'kết quả': 'isSuccessful',
  'lý do không thành': 'failureReason',
  'hình thức đấu giá': 'auctionFormat',
  'hình thức': 'auctionFormat',
  'bước giá': 'bidStep',
  'buoc gia': 'bidStep',
  'bước giá (vnd)': 'bidStep',
  'số vòng tối đa': 'maxRounds',
  'số vòng thực tế': 'actualRounds',
  'số người tham gia': 'numberOfParticipants',
  'tiền đặt trước (%)': 'depositPercentage',
  'tiền đặt trước': 'depositPercentage',
  'ghi chú': 'internalNotes',
  'số thứ tự tài sản': 'assetIndex',
  'số ts': 'assetIndex',
  'tài sản số': 'assetIndex',
  'ts số': 'assetIndex',
  'asset index': 'assetIndex',
}

export const TEMPLATE_MAPPING: ColumnMapping = {
  auctionDate: '(*) Ngày đấu giá',
  ownerName: '(*) Người có tài sản',
  auctionNumber: 'Số phiên',
  assetIndex: 'Số thứ tự tài sản (tùy chọn)',
  winningPrice: 'Giá trúng (VND)',
  isSuccessful: 'Trạng thái',
  auctionFormat: 'Hình thức đấu giá',
  biddingMethod: 'Phương thức đấu giá',
  bidStep: 'Bước giá (VND)',
  maxRounds: 'Số vòng tối đa',
  actualRounds: 'Số vòng thực tế',
  numberOfParticipants: 'Số người tham gia',
  depositPercentage: 'Tiền đặt trước (%)',
  failureReason: 'Lý do không thành',
  contractNumber: 'Số HĐ dịch vụ',
  internalNotes: 'Ghi chú',
}

const REQUIRED_TEMPLATE_HEADERS = ['(*) Ngày đấu giá', '(*) Người có tài sản']

export function validateTemplateHeaders(headers: string[]): string | null {
  const headerSet = new Set(headers)
  const missing = REQUIRED_TEMPLATE_HEADERS.filter((h) => !headerSet.has(h))
  if (missing.length > 0) {
    return `File không đúng template. Thiếu cột: ${missing.join(', ')}. Vui lòng tải file template mẫu.`
  }
  return null
}

const FORMAT_ALIASES: Record<string, AuctionFormat> = {
  'trực tiếp lời nói': 'DIRECT_VOICE',
  'lời nói': 'DIRECT_VOICE',
  'trực tiếp phiếu': 'DIRECT_PAPER',
  'phiếu': 'DIRECT_PAPER',
  'trực tuyến': 'ONLINE',
  'online': 'ONLINE',
  'kết hợp': 'HYBRID',
  'bỏ phiếu kín': 'SEALED_BID',
  'kín': 'SEALED_BID',
}

const BIDDING_METHOD_ALIASES: Record<string, BiddingMethod> = {
  'trả giá lên': 'ASCENDING',
  'ascending': 'ASCENDING',
  'đặt giá xuống': 'DESCENDING',
  'descending': 'DESCENDING',
}

const CATEGORY_ALIASES: Record<string, AssetCategory> = {
  'qsdđ': 'LAND_USE_RIGHT',
  'đất': 'LAND_USE_RIGHT',
  'nhà ở': 'REAL_ESTATE',
  'bất động sản': 'REAL_ESTATE',
  'xe cộ': 'VEHICLE',
  'phương tiện': 'VEHICLE',
  'máy móc': 'MACHINERY',
  'thiết bị': 'MACHINERY',
  'tang vật': 'ADMIN_VIOLATION',
  'thi hành án': 'ENFORCEMENT',
  'tài sản bảo đảm': 'SECURED_ASSET',
  'thế chấp': 'SECURED_ASSET',
  'khác': 'OTHER',
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  for (const h of headers) {
    const key = HEADER_ALIASES[h.toLowerCase().trim()]
    if (key) mapping[key] = h
  }
  return mapping
}

function parseDate(val: unknown): string | undefined {
  if (!val) return undefined
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (date) {
      const y = date.y
      const m = String(date.m).padStart(2, '0')
      const d = String(date.d).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  if (typeof val === 'string') {
    const parts = val.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
    if (parts) return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  }
  return undefined
}

function parsePrice(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined
  const n = typeof val === 'number' ? val : Number(String(val).replace(/[,.\s]/g, ''))
  return isNaN(n) ? undefined : n
}

function parseBoolean(val: unknown): boolean | undefined {
  if (val === undefined || val === null || val === '') return undefined
  const s = String(val).toLowerCase().trim()
  if (['thành', 'thành công', 'có', '1', 'true', 'yes'].includes(s)) return true
  if (['không thành', 'không', '0', 'false', 'no'].includes(s)) return false
  return undefined
}

function parseFormat(val: unknown): AuctionFormat | undefined {
  if (!val) return undefined
  const s = String(val).toLowerCase().trim()
  return FORMAT_ALIASES[s]
}

function parseBiddingMethod(val: unknown): BiddingMethod | undefined {
  if (!val) return undefined
  const s = String(val).toLowerCase().trim()
  return BIDDING_METHOD_ALIASES[s]
}

function parseCategory(val: unknown): AssetCategory | undefined {
  if (!val) return undefined
  const s = String(val).toLowerCase().trim()
  return CATEGORY_ALIASES[s]
}

export async function parseExcelFile(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes('dữ liệu') || n.toLowerCase().includes('data')) ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: '' })
  if (raw.length < 2) return { headers: [], rows: [] }
  const headers = (raw[0] as unknown[]).map((h) => String(h).trim())
  const rows = (raw.slice(1) as unknown[][]).map((row) => {
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => { obj[h] = (row as unknown[])[i] })
    return obj
  })
  return { headers, rows }
}

export function mapRow(raw: Record<string, unknown>, mapping: ColumnMapping): ParsedRow {
  const get = (key: ColumnKey) => {
    const col = mapping[key]
    return col ? raw[col] : undefined
  }

  const assetDesc = String(get('assetDescription') ?? '').trim()
  const autoCategory = assetDesc ? classifyAsset(assetDesc).category : 'OTHER'

  return {
    auctionDate: parseDate(get('auctionDate')),
    auctionNumber: get('auctionNumber') ? String(get('auctionNumber')) : undefined,
    assetDescription: assetDesc || undefined,
    assetCategory: parseCategory(get('assetCategory')) ?? autoCategory,
    assetLocation: get('assetLocation') ? String(get('assetLocation')) : undefined,
    ownerName: get('ownerName') ? String(get('ownerName')).trim() : undefined,
    contractNumber: get('contractNumber') ? String(get('contractNumber')) : undefined,
    contractSignedDate: parseDate(get('contractSignedDate')),
    startingPrice: parsePrice(get('startingPrice')),
    winningPrice: parsePrice(get('winningPrice')),
    isSuccessful: parseBoolean(get('isSuccessful')),
    failureReason: get('failureReason') ? String(get('failureReason')) : undefined,
    auctionFormat: parseFormat(get('auctionFormat')),
    biddingMethod: parseBiddingMethod(get('biddingMethod')),
    bidStep: parsePrice(get('bidStep')),
    maxRounds: get('maxRounds') ? Number(get('maxRounds')) : undefined,
    actualRounds: get('actualRounds') ? Number(get('actualRounds')) : undefined,
    numberOfParticipants: get('numberOfParticipants') ? Number(get('numberOfParticipants')) : undefined,
    depositPercentage: get('depositPercentage') ? Number(get('depositPercentage')) : undefined,
    internalNotes: get('internalNotes') ? String(get('internalNotes')) : undefined,
    assetIndex: get('assetIndex') ? Number(get('assetIndex')) : undefined,
  }
}

const ENRICHMENT_FIELDS: (keyof ParsedRow)[] = [
  'winningPrice', 'isSuccessful', 'failureReason', 'auctionFormat', 'biddingMethod',
  'bidStep', 'maxRounds', 'actualRounds', 'numberOfParticipants',
  'depositPercentage', 'contractNumber', 'internalNotes', 'assetIndex',
]

export function validateRows(
  rawRows: Record<string, unknown>[],
  mapping: ColumnMapping,
  existingKeys: string[],
): ValidationResult {
  const validRows: ParsedRow[] = []
  const warningRows: ValidationResult['warningRows'] = []
  const errorRows: ValidationResult['errorRows'] = []
  const unmatchedRows: number[] = []
  const existingSet = new Set(existingKeys)

  rawRows.forEach((raw, i) => {
    const rowNum = i + 2
    const data = mapRow(raw, mapping)
    const errors: string[] = []
    const warnings: string[] = []

    // Require at least one identifier to match existing records
    const hasIdentifier = !!(data.auctionDate && data.ownerName) || !!data.auctionNumber
    if (!hasIdentifier) {
      errors.push('Thiếu thông tin định danh (cần Ngày đấu giá + Người có TS, hoặc Số phiên)')
    }

    // Require at least one enrichment field
    const hasEnrichment = ENRICHMENT_FIELDS.some((f) => data[f] !== undefined)
    if (!hasEnrichment) {
      errors.push('Không có trường bổ sung nào (giá trúng, hình thức, bước giá...)')
    }

    if (data.winningPrice !== undefined && data.startingPrice !== undefined && data.winningPrice < data.startingPrice) {
      warnings.push('Giá trúng nhỏ hơn giá khởi điểm')
    }

    // Check if there's a matching existing record
    const matchKey = (data.auctionDate ?? '') + (data.ownerName ?? '')
    if (hasIdentifier && !existingSet.has(matchKey) && !existingSet.has(data.auctionNumber ?? '__no_match__')) {
      unmatchedRows.push(rowNum)
      warnings.push('Không tìm thấy cuộc đấu giá tương ứng trong hệ thống')
    }

    if (errors.length > 0) {
      errorRows.push({ row: rowNum, rawData: raw, errors })
    } else if (warnings.length > 0) {
      warningRows.push({ row: rowNum, data, warnings })
      validRows.push(data)
    } else {
      validRows.push(data)
    }
  })

  return {
    validRows,
    warningRows,
    errorRows,
    duplicateRows: unmatchedRows,
    headers: Object.values(mapping).filter(Boolean) as string[],
  }
}

export function generateExcelTemplate(): void {
  const wb = XLSX.utils.book_new()

  const guide = [
    ['HƯỚNG DẪN BỔ SUNG KẾT QUẢ ĐẤU GIÁ HÀNG LOẠT'],
    [],
    ['MỤC ĐÍCH: File này dùng để BỔ SUNG thông tin kết quả cho các cuộc đấu giá'],
    ['đã được đồng bộ tự động từ Cổng quốc gia. KHÔNG dùng để thêm cuộc mới.'],
    [],
    ['Cột định danh (bắt buộc để ghép với cuộc đấu giá đã có):'],
    ['- (*) Ngày đấu giá', 'Định dạng DD/MM/YYYY — phải khớp với ngày trên hệ thống'],
    ['- (*) Người có tài sản', 'Phải khớp chính xác với tên trên hệ thống'],
    ['  (hoặc dùng Số phiên thay thế nếu có)'],
    ['- Số thứ tự tài sản (tùy chọn)', 'Để trống nếu chỉ có 1 tài sản. Điền 1, 2, 3... khi phiên có nhiều tài sản — mỗi tài sản một dòng riêng'],
    [],
    ['Cột bổ sung kết quả (điền ít nhất một cột):'],
    ['- ★ Giá trúng (VND)', 'Số nguyên. Quan trọng nhất — ảnh hưởng điểm IV.3-4'],
    ['- ★ Trạng thái', '"Thành" hoặc "Không thành"'],
    ['- ★ Hình thức đấu giá', '"Trực tuyến" / "Lời nói" / "Phiếu" / "Kết hợp" / "Bỏ phiếu kín"'],
    ['- ★ Phương thức đấu giá', '"Trả giá lên" / "Đặt giá xuống"'],
    ['- ★ Bước giá (VND)', 'Số nguyên VND'],
    ['- Số vòng tối đa', 'Số nguyên'],
    ['- Số vòng thực tế', 'Số nguyên'],
    ['- Số người tham gia', 'Số nguyên'],
    ['- Tiền đặt trước (%)', 'Số thực, ví dụ: 10 = 10%'],
    ['- Lý do không thành', 'Điền nếu không thành'],
    ['- Số HĐ dịch vụ'],
    ['- Ghi chú'],
  ]
  const wsGuide = XLSX.utils.aoa_to_sheet(guide)
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Hướng dẫn')

  const headers = [
    '(*) Ngày đấu giá',
    '(*) Người có tài sản',
    'Số phiên',
    'Số thứ tự tài sản (tùy chọn)',
    'Giá trúng (VND)',
    'Trạng thái',
    'Hình thức đấu giá',
    'Phương thức đấu giá',
    'Bước giá (VND)',
    'Số vòng tối đa',
    'Số vòng thực tế',
    'Số người tham gia',
    'Tiền đặt trước (%)',
    'Lý do không thành',
    'Số HĐ dịch vụ',
    'Ghi chú',
  ]
  const wsData = XLSX.utils.aoa_to_sheet([headers])
  XLSX.utils.book_append_sheet(wb, wsData, 'Dữ liệu')

  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, 'template_bo_sung_ket_qua.xlsx')
}

export function exportErrorRows(
  errorRows: ValidationResult['errorRows'],
  headers: string[],
): void {
  const data = errorRows.map((e) => ({
    'Dòng': e.row,
    'Lỗi': e.errors.join('; '),
    ...e.rawData,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lỗi')
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, 'import_errors.xlsx')
  void headers
}

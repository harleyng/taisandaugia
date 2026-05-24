import { supabase } from '@/integrations/supabase/client'
import { Announcement } from '@/types/application'

export interface ScrapeResult {
  ok: boolean
  data: Partial<Announcement>
  fieldsFound: number
  error?: ScrapeError
}

export type ScrapeError =
  | 'bot_protection'    // site blocks automated requests
  | 'fetch_failed'      // HTTP error
  | 'no_data'           // parsed but nothing found
  | 'network'           // cannot reach edge function
  | 'invalid_url'
  | 'unknown'

// ---------------------------------------------------------------------------
// Via Supabase Edge Function
// ---------------------------------------------------------------------------

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  try {
    const { data: resp, error } = await supabase.functions.invoke('fetch-announcement', {
      body: { url },
    })

    if (error) {
      return { ok: false, data: {}, fieldsFound: 0, error: 'network' }
    }

    if (resp.error) {
      const errCode = resp.error as ScrapeError
      return { ok: false, data: {}, fieldsFound: 0, error: errCode }
    }

    const fieldsFound = resp.fieldsFound as number
    const raw = resp.data as Record<string, unknown>

    if (fieldsFound === 0) {
      return { ok: false, data: {}, fieldsFound: 0, error: 'no_data' }
    }

    return { ok: true, data: mapRawToAnnouncement(raw), fieldsFound }
  } catch {
    return { ok: false, data: {}, fieldsFound: 0, error: 'unknown' }
  }
}

// ---------------------------------------------------------------------------
// Client-side text paste parser (no network needed)
// ---------------------------------------------------------------------------

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function parseVietnameseDate(text: string): string {
  const clean = text
    .replace(/(\d+)\s*giờ\s*\d*\s*phút?/i, '') // remove time part
    .replace(/ngày/gi, '/')
    .replace(/tháng/gi, '/')
    .replace(/năm/gi, '/')
    .replace(/\s+/g, '')
    .trim()

  const dmy = clean.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return text.trim()
}

function parseVietnamesePrice(text: string): number | undefined {
  // Handle formats: 15.000.000.000 đồng, 15,000,000,000 VND, 15 tỷ
  const billionMatch = text.match(/([\d.,]+)\s*tỷ/i)
  if (billionMatch) {
    const val = parseFloat(billionMatch[1].replace(/\./g, '').replace(',', '.'))
    return Math.round(val * 1_000_000_000)
  }

  const millionMatch = text.match(/([\d.,]+)\s*triệu/i)
  if (millionMatch) {
    const val = parseFloat(millionMatch[1].replace(/\./g, '').replace(',', '.'))
    return Math.round(val * 1_000_000)
  }

  // Plain number: 15.000.000.000 or 15,000,000,000
  const digits = text.replace(/[^\d.,]/g, '')
  // Detect thousand separator style
  const hasDotThousands = /\d{1,3}(\.\d{3})+/.test(digits)
  if (hasDotThousands) {
    return parseInt(digits.replace(/\./g, ''), 10)
  }
  const hasCommaThousands = /\d{1,3}(,\d{3})+/.test(digits)
  if (hasCommaThousands) {
    return parseInt(digits.replace(/,/g, ''), 10)
  }
  const plain = parseInt(digits.replace(/[.,]/g, ''), 10)
  return isNaN(plain) ? undefined : plain
}

function detectProvince(text: string): string | undefined {
  const provinces = [
    'Hà Nội', 'TP. Hồ Chí Minh', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
    'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu', 'Bắc Ninh',
    'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước', 'Bình Thuận', 'Cà Mau',
    'Cao Bằng', 'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp',
    'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình',
    'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lâm Đồng',
    'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định', 'Nghệ An', 'Ninh Bình', 'Ninh Thuận',
    'Phú Thọ', 'Phú Yên', 'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh',
    'Quảng Trị', 'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
    'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
    'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
  ]
  const lower = text.toLowerCase()
  return provinces.find((p) => lower.includes(p.toLowerCase()))
}

function detectAssetCategory(text: string): Announcement['assetCategory'] {
  const lower = text.toLowerCase()
  if (lower.match(/quyền sử dụng đất|qsdđ|đất ở|đất nông|đất sản xuất|mặt sàn|nhà ở/)) return 'LAND_USE_RIGHT'
  if (lower.match(/tang vật|phương tiện vi phạm hành chính|vphc/)) return 'ADMIN_VIOLATION'
  if (lower.match(/thi hành án|kê biên/)) return 'ENFORCEMENT'
  if (lower.match(/máy móc|thiết bị|dây chuyền/)) return 'MACHINERY'
  if (lower.match(/xe ô tô|xe tải|xe máy|phương tiện giao thông/)) return 'VEHICLE'
  return 'OTHER'
}

type FieldKey = keyof Pick<
  Announcement,
  'ownerName' | 'assetDescription' | 'assetLocation' | 'announcementNumber' | 'deadline' | 'announcementDate'
>

const STRING_PATTERNS: Record<FieldKey, RegExp[]> = {
  ownerName: [
    /người có tài sản[:\s–-]+([^\n\r]+)/i,
    /chủ tài sản[:\s–-]+([^\n\r]+)/i,
    /đơn vị có tài sản[:\s–-]+([^\n\r]+)/i,
    /cơ quan có tài sản[:\s–-]+([^\n\r]+)/i,
    /bên có tài sản[:\s–-]+([^\n\r]+)/i,
  ],
  assetDescription: [
    /tên tài sản[:\s–-]+([^\n\r]+)/i,
    /tài sản đấu giá[:\s–-]+([^\n\r]+)/i,
    /mô tả tài sản[:\s–-]+([^\n\r]+)/i,
    /tài sản[:\s–-]+([^\n\r]{20,})/i,
  ],
  assetLocation: [
    /địa chỉ tài sản[:\s–-]+([^\n\r]+)/i,
    /địa điểm tài sản[:\s–-]+([^\n\r]+)/i,
    /vị trí tài sản[:\s–-]+([^\n\r]+)/i,
    /địa chỉ[:\s–-]+([^\n\r]+)/i,
  ],
  announcementNumber: [
    /số thông báo[:\s–-]+([^\n\r]+)/i,
    /thông báo số[:\s–-]+([^\n\r]+)/i,
    /số[:\s]+([A-Z0-9\/\-]+\/(?:\d{4}|BTP|UBND|TB))/i,
  ],
  deadline: [
    /hạn nộp hồ sơ[:\s–-]+([^\n\r]+)/i,
    /hạn đăng ký[:\s–-]+([^\n\r]+)/i,
    /thời hạn nộp hồ sơ[:\s–-]+([^\n\r]+)/i,
    /hạn nhận hồ sơ[:\s–-]+([^\n\r]+)/i,
    /thời hạn đăng ký[:\s–-]+([^\n\r]+)/i,
    /hạn cuối[:\s–-]+([^\n\r]+)/i,
  ],
  announcementDate: [
    /ngày thông báo[:\s–-]+([^\n\r]+)/i,
    /ngày[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
  ],
}

export function parseAnnouncementText(text: string): ScrapeResult {
  const data: Partial<Announcement> = {}
  let fieldsFound = 0

  // Extract string fields
  for (const [field, patterns] of Object.entries(STRING_PATTERNS) as [FieldKey, RegExp[]][]) {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1]) {
        const value = cleanText(match[1])
        if (!value) continue

        if (field === 'deadline' || field === 'announcementDate') {
          data[field] = parseVietnameseDate(value)
        } else {
          data[field] = value
        }
        fieldsFound++
        break
      }
    }
  }

  // Extract price
  const pricePatterns = [
    /giá khởi điểm[:\s–-]+([^\n\r]+)/i,
    /giá bán khởi điểm[:\s–-]+([^\n\r]+)/i,
    /mức giá khởi điểm[:\s–-]+([^\n\r]+)/i,
  ]
  for (const pattern of pricePatterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const price = parseVietnamesePrice(match[1])
      if (price) {
        data.startingPrice = price
        fieldsFound++
        break
      }
    }
  }

  // Derive province
  const searchForProvince = [data.assetLocation, data.ownerName, text.slice(0, 2000)].join(' ')
  const province = detectProvince(searchForProvince)
  if (province) {
    data.province = province
    fieldsFound++
  }

  // Derive category
  const searchForCategory = [data.assetDescription, text.slice(0, 1000)].join(' ')
  data.assetCategory = detectAssetCategory(searchForCategory)

  const ok = fieldsFound >= 2
  return { ok, data, fieldsFound, error: ok ? undefined : 'no_data' }
}

// ---------------------------------------------------------------------------
// Map raw edge function response to Announcement partial
// ---------------------------------------------------------------------------

function mapRawToAnnouncement(raw: Record<string, unknown>): Partial<Announcement> {
  return {
    ownerName: raw.ownerName as string | undefined,
    assetDescription: raw.assetDescription as string | undefined,
    assetCategory: raw.assetCategory as Announcement['assetCategory'] | undefined,
    startingPrice: raw.startingPrice as number | undefined,
    assetLocation: raw.assetLocation as string | undefined,
    province: raw.province as string | undefined,
    deadline: raw.deadline as string | undefined,
    announcementNumber: raw.announcementNumber as string | undefined,
    announcementDate: raw.announcementDate as string | undefined,
  }
}

// ---------------------------------------------------------------------------
// Error messages for UI
// ---------------------------------------------------------------------------

export const SCRAPE_ERROR_MESSAGES: Record<ScrapeError, string> = {
  bot_protection:
    'Trang web này có hệ thống bảo vệ chống bot — không thể tự động trích xuất. Hãy mở link, sao chép nội dung và dán vào ô bên dưới.',
  fetch_failed: 'Không thể tải trang. Kiểm tra lại URL hoặc thử dán nội dung thủ công.',
  no_data: 'Tải được trang nhưng không nhận ra cấu trúc dữ liệu. Hãy dán nội dung thủ công.',
  network: 'Lỗi kết nối. Kiểm tra mạng hoặc thử lại.',
  invalid_url: 'URL không hợp lệ.',
  unknown: 'Lỗi không xác định. Hãy thử dán nội dung thủ công.',
}

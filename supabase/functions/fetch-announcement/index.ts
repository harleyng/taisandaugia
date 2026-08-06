import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
}

interface ExtractedData {
  ownerName?: string
  assetDescription?: string
  assetCategory?: string
  startingPrice?: number
  assetLocation?: string
  province?: string
  deadline?: string
  announcementNumber?: string
  announcementDate?: string
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim()
}

function parseVietnameseDate(text: string): string | undefined {
  // Handles: 16/06/2026, 16 tháng 06 năm 2026, ngày 16/06/2026
  const clean = text.replace(/ngày|tháng|năm/gi, '/').replace(/\s+/g, '').trim()

  // DD/MM/YYYY
  const dmy = clean.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return undefined
}

function parseVietnamesePrice(text: string): number | undefined {
  // Remove all non-digit chars except dots/commas
  const digits = text.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(/,/g, '')
  const num = parseInt(digits, 10)
  return isNaN(num) ? undefined : num
}

function detectAssetCategory(text: string): string | undefined {
  const lower = text.toLowerCase()
  if (lower.match(/quyền sử dụng đất|qsdđ|đất ở|đất nông nghiệp|đất sản xuất/)) return 'LAND_USE_RIGHT'
  if (lower.match(/tang vật|phương tiện vi phạm hành chính|vphc/)) return 'ADMIN_VIOLATION'
  if (lower.match(/thi hành án|kê biên/)) return 'ENFORCEMENT'
  if (lower.match(/máy móc|thiết bị|dây chuyền sản xuất/)) return 'MACHINERY'
  if (lower.match(/xe ô tô|xe tải|phương tiện giao thông|xe máy/)) return 'VEHICLE'
  return 'OTHER'
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

// Field extraction patterns — ordered by specificity
const FIELD_PATTERNS: Record<keyof ExtractedData, RegExp[]> = {
  ownerName: [
    /người có tài sản[:\s]+([^\n\r<|]+)/i,
    /chủ tài sản[:\s]+([^\n\r<|]+)/i,
    /đơn vị có tài sản[:\s]+([^\n\r<|]+)/i,
    /cơ quan có tài sản[:\s]+([^\n\r<|]+)/i,
    /bên có tài sản[:\s]+([^\n\r<|]+)/i,
  ],
  startingPrice: [
    /giá khởi điểm[:\s]+([0-9.,\s]+(?:đồng|vnd|vnđ)?)/i,
    /giá bán khởi điểm[:\s]+([0-9.,\s]+(?:đồng|vnd|vnđ)?)/i,
    /mức giá khởi điểm[:\s]+([0-9.,\s]+(?:đồng|vnd|vnđ)?)/i,
  ],
  deadline: [
    /hạn nộp hồ sơ[:\s]+([^\n\r<|]+)/i,
    /hạn đăng ký[:\s]+([^\n\r<|]+)/i,
    /thời hạn nộp hồ sơ[:\s]+([^\n\r<|]+)/i,
    /hạn nhận hồ sơ[:\s]+([^\n\r<|]+)/i,
    /thời hạn đăng ký[:\s]+([^\n\r<|]+)/i,
  ],
  announcementNumber: [
    /số thông báo[:\s]+([^\n\r<|]+)/i,
    /thông báo số[:\s]+([^\n\r<|]+)/i,
    /số[:\s]+([A-Z0-9/-]+\/(?:UBND|BTP|TB|TB-[A-Z]+))/i,
  ],
  announcementDate: [
    /ngày thông báo[:\s]+([^\n\r<|]+)/i,
    /ngày[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
    /date[:\s]+([^\n\r<|]+)/i,
  ],
  assetLocation: [
    /địa chỉ tài sản[:\s]+([^\n\r<|]+)/i,
    /địa điểm tài sản[:\s]+([^\n\r<|]+)/i,
    /vị trí tài sản[:\s]+([^\n\r<|]+)/i,
    /địa chỉ[:\s]+([^\n\r<|]+)/i,
  ],
  assetDescription: [
    /tên tài sản[:\s]+([^\n\r<|]+)/i,
    /tài sản đấu giá[:\s]+([^\n\r<|]+)/i,
    /mô tả tài sản[:\s]+([^\n\r<|]+)/i,
  ],
  province: [], // derived from text
  assetCategory: [], // derived
}

function extractFromText(text: string): ExtractedData {
  const result: ExtractedData = {}
  const cleanedText = text.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')

  for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
    if (patterns.length === 0) continue
    for (const pattern of patterns) {
      const match = cleanedText.match(pattern)
      if (match?.[1]) {
        const value = cleanText(match[1])
        if (field === 'startingPrice') {
          result.startingPrice = parseVietnamesePrice(value)
        } else if (field === 'deadline' || field === 'announcementDate') {
          result[field as 'deadline' | 'announcementDate'] = parseVietnameseDate(value) ?? value
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(result as any)[field] = value
        }
        break
      }
    }
  }

  // Derive province from location/owner/text
  if (!result.province) {
    const searchText = [result.assetLocation, result.ownerName, cleanedText.slice(0, 2000)].join(' ')
    result.province = detectProvince(searchText)
  }

  // Derive category from description + full text
  if (!result.assetCategory && result.assetDescription) {
    result.assetCategory = detectAssetCategory(result.assetDescription + ' ' + cleanedText.slice(0, 1000))
  }

  return result
}

// dgts.moj.gov.vn specific: extract title from <h1> or page title
function extractDgtsSpecific(html: string): ExtractedData {
  const result = extractFromText(html)

  // Try h1 for asset description if not found
  if (!result.assetDescription) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) result.assetDescription = cleanText(h1Match[1])

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch && !result.assetDescription) {
      result.assetDescription = cleanText(titleMatch[1].replace(/\s*[-|].*$/, ''))
    }
  }

  // Try to find table rows (common pattern: <td>Label</td><td>Value</td>)
  const tableRows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  for (const row of tableRows) {
    const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? []
    if (cells.length >= 2) {
      const label = cleanText(cells[0].replace(/<[^>]+>/g, ''))
      const value = cleanText(cells[1].replace(/<[^>]+>/g, ''))
      if (!value) continue

      if (/người có tài sản|chủ tài sản/i.test(label)) result.ownerName = value
      else if (/giá khởi điểm/i.test(label)) result.startingPrice = parseVietnamesePrice(value)
      else if (/hạn nộp|hạn đăng ký/i.test(label)) result.deadline = parseVietnameseDate(value) ?? value
      else if (/số thông báo|thông báo số/i.test(label)) result.announcementNumber = value
      else if (/ngày thông báo/i.test(label)) result.announcementDate = parseVietnameseDate(value) ?? value
      else if (/địa chỉ tài sản|vị trí/i.test(label)) result.assetLocation = value
      else if (/tên tài sản|tài sản đấu giá/i.test(label)) result.assetDescription = value
      else if (/tỉnh|thành phố/i.test(label)) result.province = value
    }
  }

  // Also try definition lists: <dt>Label</dt><dd>Value</dd>
  const dtMatches = [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)]
  for (const [, labelHtml, valueHtml] of dtMatches) {
    const label = cleanText(labelHtml.replace(/<[^>]+>/g, ''))
    const value = cleanText(valueHtml.replace(/<[^>]+>/g, ''))
    if (!value) continue

    if (/người có tài sản|chủ tài sản/i.test(label)) result.ownerName = value
    else if (/giá khởi điểm/i.test(label)) result.startingPrice = parseVietnamesePrice(value)
    else if (/hạn nộp|hạn đăng ký/i.test(label)) result.deadline = parseVietnameseDate(value) ?? value
    else if (/số thông báo/i.test(label)) result.announcementNumber = value
    else if (/ngày thông báo/i.test(label)) result.announcementDate = parseVietnameseDate(value) ?? value
    else if (/địa chỉ tài sản/i.test(label)) result.assetLocation = value
    else if (/tên tài sản|tài sản/i.test(label)) result.assetDescription = value
  }

  // Derive province if still missing
  if (!result.province) {
    const searchText = [result.assetLocation, result.ownerName, html.slice(0, 3000)].join(' ')
    result.province = detectProvince(searchText)
  }

  // Derive category
  if (!result.assetCategory && result.assetDescription) {
    result.assetCategory = detectAssetCategory(result.assetDescription)
  }

  return result
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'missing_url' }, { headers: CORS_HEADERS, status: 400 })
    }

    // Only allow http/https
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return Response.json({ error: 'invalid_url' }, { headers: CORS_HEADERS, status: 400 })
    }

    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    })

    const html = await response.text()

    // Detect bot protection challenge
    if (html.includes('fec_wrapper.js') || html.includes('_fec_sbu') || html.includes('#ENCODED#')) {
      return Response.json(
        { error: 'bot_protection', message: 'Trang web có bảo vệ chống bot — không thể tự động trích xuất.' },
        { headers: CORS_HEADERS }
      )
    }

    if (response.status >= 400) {
      return Response.json(
        { error: 'fetch_failed', message: `HTTP ${response.status}` },
        { headers: CORS_HEADERS }
      )
    }

    const data = extractDgtsSpecific(html)
    const fieldsFound = Object.values(data).filter(Boolean).length

    return Response.json(
      { data, fieldsFound, sourceUrl: url },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: 'exception', message }, { headers: CORS_HEADERS, status: 500 })
  }
})

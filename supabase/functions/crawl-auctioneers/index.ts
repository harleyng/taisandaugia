// Deploy: npx supabase functions deploy crawl-auctioneers --project-ref bcusbpkfnydqcvxxjvew
// Searches dgts.moj.gov.vn for registered auctioneers by organization tax code (MST)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CrawledAuctioneer {
  fullName: string
  dateOfBirth?: string
  permanentAddress?: string
  professionalCertNumber: string
  professionalCertIssuedDate?: string
  licenseNumber: string
  licenseIssuedDate: string
  joinedDate: string
  crawledFromUrl: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { taxCode } = await req.json() as { taxCode?: string }

    if (!taxCode || taxCode.trim().length < 8) {
      return new Response(
        JSON.stringify({ error: 'invalid_tax_code', message: 'MST không hợp lệ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const cleanTaxCode = taxCode.trim().replace(/[^0-9]/g, '')

    // Try the public auctioneer registry search
    // dgts.moj.gov.vn lists registered auctioneers filterable by organization
    const searchUrl = `https://dgts.moj.gov.vn/danh-sach-dau-gia-vien-hanh-nghe?maSoThue=${encodeURIComponent(cleanTaxCode)}`

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      signal: AbortSignal.timeout(20000),
    })

    const html = await response.text()

    // Detect bot protection (PerimeterX)
    if (
      html.includes('fec_wrapper.js') ||
      html.includes('#ENCODED#') ||
      html.includes('_fec_sbu') ||
      html.includes('perimeterx') ||
      html.includes('px-captcha')
    ) {
      return new Response(
        JSON.stringify({ error: 'bot_protection', message: 'Cổng QG yêu cầu xác thực, vui lòng thử lại sau.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const auctioneers = parseAuctioneers(html, searchUrl)

    if (auctioneers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'no_data', sourceUrl: searchUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ data: auctioneers, sourceUrl: searchUrl, totalFound: auctioneers.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: 'fetch_failed', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
}

function parseVietnameseDate(raw: string): string | undefined {
  // dd/mm/yyyy → yyyy-mm-dd
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return undefined
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function parseAuctioneers(html: string, sourceUrl: string): CrawledAuctioneer[] {
  const results: CrawledAuctioneer[] = []

  // Parse table rows — dgts.moj.gov.vn typically renders a <table> with rows
  // Columns vary but common order: STT | Họ tên | Số CCHN | Số thẻ ĐGV | Ngày cấp | Tổ chức
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null
  let rowIndex = 0

  while ((rowMatch = rowRe.exec(html)) !== null) {
    rowIndex++
    if (rowIndex === 1) continue // skip header

    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      stripTags(m[1]).replace(/\s+/g, ' ').trim(),
    )

    if (cells.length < 3) continue

    const auctioneer = extractFromCells(cells, sourceUrl)
    if (auctioneer) results.push(auctioneer)
  }

  return results
}

function extractFromCells(cells: string[], sourceUrl: string): CrawledAuctioneer | null {
  // Find cells by content pattern
  const licenseCell = cells.find((c) => /\d+\/ĐGV/i.test(c))
  const certCell = cells.find((c) => /\/TP\/ĐG-CCHN/i.test(c))

  if (!licenseCell && !certCell) return null

  // Name: first cell with 2+ Vietnamese words that isn't a number or code
  const nameCell = cells.find(
    (c) => c.length > 4 && !/^\d/.test(c) && !/\//.test(c) && c.split(' ').length >= 2,
  )
  if (!nameCell) return null

  const licenseNumberMatch = licenseCell?.match(/\d+\/ĐGV/i)
  const certNumberMatch = certCell?.match(/[^\s,]+\/TP\/ĐG-CCHN/i)

  // First date-looking cell
  const dateCell = cells.find((c) => /\d{2}\/\d{2}\/\d{4}/.test(c))
  const parsedDate = dateCell ? parseVietnameseDate(dateCell) : undefined
  const licenseIssuedDate = parsedDate ?? new Date().toISOString().split('T')[0]

  return {
    fullName: nameCell,
    licenseNumber: licenseNumberMatch?.[0] ?? (licenseCell || ''),
    professionalCertNumber: certNumberMatch?.[0] ?? (certCell || ''),
    licenseIssuedDate,
    joinedDate: licenseIssuedDate,
    crawledFromUrl: sourceUrl,
  }
}

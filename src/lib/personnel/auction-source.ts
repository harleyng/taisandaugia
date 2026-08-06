// Cuộc đấu giá do một đấu giá viên điều hành.
//
// NGUỒN: bảng `org_auction_records` trên Supabase — thành tích đấu giá của tổ
// chức, KHÔNG phải tin rao (`listings`). Phần lớn là việc cũ có trước cả sàn
// nên sẽ không bao giờ tồn tại dưới dạng tin rao; nhét vào `listings` đồng
// nghĩa đẩy tài sản không có thật lên sàn công khai.
//
// Liên kết bằng FK `auctioneer_id` thay cho khớp chuỗi họ tên như bản trước —
// đổi tên người là mất sạch liên kết.

import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import { ASSET_CATEGORY_LABELS } from '@/lib/applications/labels'

type Row = Database['public']['Tables']['org_auction_records']['Row']

export interface ConductedAuction {
  id: string
  date?: string
  auctionNumber?: string
  assetDescription: string
  assetCategory: string
  ownerName: string
  contractNumber?: string
  startingPrice?: number
  winningPrice?: number
  isSuccessful?: boolean
  participants?: number
  /** Chênh lệch tuyệt đối so với giá khởi điểm; undefined nếu thiếu một trong hai giá. */
  priceDiff?: number
  /** Chênh lệch theo %. */
  priceDiffPercent?: number
}

function toConducted(r: Row): ConductedAuction {
  const start = r.starting_price === null ? undefined : Number(r.starting_price)
  const win = r.winning_price === null ? undefined : Number(r.winning_price)
  const hasBoth = !!win && !!start && start > 0
  return {
    id: r.id,
    date: r.auction_date ?? undefined,
    auctionNumber: r.auction_number ?? undefined,
    assetDescription: r.asset_description,
    assetCategory: r.asset_category,
    ownerName: r.owner_name ?? '',
    contractNumber: r.contract_number ?? undefined,
    startingPrice: start,
    winningPrice: win,
    isSuccessful: r.is_successful ?? undefined,
    participants: r.number_of_participants ?? undefined,
    priceDiff: hasBoth ? win - start : undefined,
    priceDiffPercent: hasBoth ? ((win - start) / start) * 100 : undefined,
  }
}

// ASSET_CATEGORY_LABELS thiếu REAL_ESTATE và SECURED_ASSET dù AssetCategory có
// khai báo — bù ở đây để nhãn không rơi về mã máy khi in ra hồ sơ.
const EXTRA_CATEGORY_LABELS: Record<string, string> = {
  REAL_ESTATE: 'Bất động sản',
  SECURED_ASSET: 'Tài sản bảo đảm',
}

export function categoryLabel(code: string): string {
  return ASSET_CATEGORY_LABELS[code] ?? EXTRA_CATEGORY_LABELS[code] ?? code
}

/** Cuộc đấu giá của MỘT đấu giá viên, mới nhất trước. */
export async function fetchAuctionsByAuctioneer(auctioneerId: string): Promise<ConductedAuction[]> {
  const { data, error } = await supabase
    .from('org_auction_records')
    .select('*')
    .eq('auctioneer_id', auctioneerId)
    .order('auction_date', { ascending: false })
  if (error) throw error
  return (data as Row[]).map(toConducted)
}

/** Toàn bộ lịch sử đấu giá của tổ chức. */
export async function fetchAuctionsByOrg(organizationId: string): Promise<ConductedAuction[]> {
  const { data, error } = await supabase
    .from('org_auction_records')
    .select('*')
    .eq('organization_id', organizationId)
    .order('auction_date', { ascending: false })
  if (error) throw error
  return (data as Row[]).map(toConducted)
}

export interface CategoryCount {
  code: string
  label: string
  count: number
}

export interface AuctionStats {
  total: number
  successful: number
  totalWinningValue: number
  /** Trung bình % chênh lệch so với giá khởi điểm, chỉ tính cuộc có đủ hai giá. */
  avgDiffPercent: number | null
  avgDiffAmount: number | null
  topCategories: CategoryCount[]
}

export function auctionStats(list: ConductedAuction[]): AuctionStats {
  // Chỉ lấy cuộc có ĐỦ hai giá: đấu giá không thành không có giá trúng, đưa
  // vào sẽ kéo trung bình xuống 0 và làm sai lệch con số.
  const withDiff = list.filter((a) => a.priceDiffPercent !== undefined)

  const byCategory = new Map<string, number>()
  for (const a of list) {
    byCategory.set(a.assetCategory, (byCategory.get(a.assetCategory) ?? 0) + 1)
  }

  return {
    total: list.length,
    successful: list.filter((a) => a.isSuccessful).length,
    totalWinningValue: list.reduce((s, a) => s + (a.winningPrice ?? 0), 0),
    avgDiffPercent: withDiff.length
      ? withDiff.reduce((s, a) => s + (a.priceDiffPercent ?? 0), 0) / withDiff.length
      : null,
    avgDiffAmount: withDiff.length
      ? withDiff.reduce((s, a) => s + (a.priceDiff ?? 0), 0) / withDiff.length
      : null,
    topCategories: [...byCategory.entries()]
      .map(([code, count]) => ({ code, label: categoryLabel(code), count }))
      .sort((a, b) => b.count - a.count),
  }
}

/**
 * Cuộc tiêu biểu — xếp theo % chênh lệch giảm dần.
 *
 * Theo đúng thứ tự trong thiết kế `Ho So Nhan Su - Mau Xuat PDF.html`
 * (+65,4% → +49,5% → +39,4% → +28,7%): "tiêu biểu" đo bằng mức vượt giá khởi
 * điểm, không phải quy mô tuyệt đối — một cuộc nhỏ vượt 65% nói lên năng lực
 * điều hành hơn một cuộc lớn vượt 10%.
 */
export function notableAuctions(list: ConductedAuction[], limit = 5): ConductedAuction[] {
  return list
    .filter((a) => (a.priceDiffPercent ?? 0) > 0)
    .sort((a, b) => (b.priceDiffPercent ?? 0) - (a.priceDiffPercent ?? 0))
    .slice(0, limit)
}

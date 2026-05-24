import type { AssetCategory } from '@/types/auction-record'

const CATEGORY_KEYWORDS: Record<AssetCategory, string[]> = {
  LAND_USE_RIGHT: ['quyền sử dụng đất', 'qsdđ', 'thửa đất', 'lô đất', 'đất ở', 'đất nông nghiệp', 'đất trồng', 'đất rừng'],
  REAL_ESTATE: ['nhà ở', 'căn hộ', 'chung cư', 'biệt thự', 'nhà phố', 'công trình xây dựng', 'bất động sản'],
  VEHICLE: ['ô tô', 'xe máy', 'xe tải', 'mô tô', 'xe buýt', 'phương tiện', 'xe con', 'xe khách'],
  MACHINERY: ['máy', 'thiết bị', 'dây chuyền', 'máy móc', 'công cụ', 'thiết bị công nghiệp'],
  ADMIN_VIOLATION: ['tang vật', 'vi phạm hành chính', 'tịch thu', 'vphc'],
  ENFORCEMENT: ['thi hành án', 'kê biên'],
  SECURED_ASSET: ['tài sản bảo đảm', 'thế chấp', 'cầm cố'],
  OTHER: [],
}

export function classifyAsset(description: string): { category: AssetCategory; confidence: number } {
  const lower = description.toLowerCase()
  const scores: Partial<Record<AssetCategory, number>> = {}

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [AssetCategory, string[]][]) {
    if (cat === 'OTHER') continue
    scores[cat] = keywords.filter((k) => lower.includes(k)).length
  }

  const entries = Object.entries(scores) as [AssetCategory, number][]
  const top = entries.sort((a, b) => b[1] - a[1])[0]

  if (!top || top[1] === 0) return { category: 'OTHER', confidence: 0 }

  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  return {
    category: top[0],
    confidence: total > 0 ? top[1] / total : 0,
  }
}

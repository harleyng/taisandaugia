// Cập nhật MỘT mục điểm trong hồ sơ năng lực tổng hợp.
//
// Năm module cùng ghi vào org_capacity_profile — thuế (IV.9), thông tin chung
// (I + IV.5), cơ sở vật chất (II), lịch sử đấu giá (IV.1–4), đấu giá viên
// (IV.6–8) — và cả năm đều cần đúng một trình tự: đọc bản hiện tại, thay phần
// của mình, TRỪ điểm cũ của mục đó rồi CỘNG điểm mới vào tổng, ghi lại.
//
// Trước đây trình tự này bị chép ở từng hook. Chép sai một chỗ (quên trừ điểm
// cũ) thì tổng phình lên mỗi lần lưu mà không có gì báo.

import type { CapacityProfile } from '@/types/capacity-profile'
import { getCapacityProfile, saveCapacityProfile } from './supabase-repo'

/** Tổ chức chưa nhập gì. KHÔNG dùng dữ liệu mẫu — xem chú thích ở useCapacityProfile. */
export const EMPTY_CAPACITY_PROFILE: CapacityProfile = {
  onMinistryList: false,
  scoreII: 0,
  scoreIV1to4: 0,
  auctionsCompleted: 0,
  auctionsMissingPrice: 0,
  scoreIV5: 0,
  yearsActive: 0,
  scoreIV6to8: 0,
  auctioneerCount: 0,
  scoreIV9: 0,
  taxPaidPreviousYear: 0,
  totalCapacityScore: 0,
  warnings: [],
}

/** Các trường điểm được tính vào tổng /76. */
export type ScoreField = 'scoreII' | 'scoreIV1to4' | 'scoreIV5' | 'scoreIV6to8' | 'scoreIV9'

/**
 * Ghi lại hồ sơ năng lực với `patch`, và nếu `scoreField` được truyền thì tự
 * điều chỉnh totalCapacityScore theo công thức (tổng − điểm cũ + điểm mới).
 *
 * Luôn ĐỌC LẠI từ DB trước khi ghi: thành viên khác trong cùng tổ chức có thể
 * vừa cập nhật một mục khác, tính trên bản cache cũ sẽ ghi đè điểm của họ.
 */
export async function patchCapacityProfile(
  organizationId: string,
  patch: Partial<CapacityProfile>,
  scoreField?: ScoreField,
): Promise<void> {
  if (!organizationId) return
  const base = (await getCapacityProfile(organizationId)) ?? EMPTY_CAPACITY_PROFILE

  const next: CapacityProfile = { ...base, ...patch }
  if (scoreField) {
    const before = base[scoreField]
    const after = next[scoreField]
    next.totalCapacityScore = base.totalCapacityScore - before + after
  }
  await saveCapacityProfile(next, organizationId)
}

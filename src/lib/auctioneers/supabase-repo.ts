// Truy cập bảng org_auctioneers. Tách khỏi hook để useAuctioneers chỉ còn lo
// React Query + phần tính toán dẫn xuất.

import { supabase } from '@/integrations/supabase/client'
import type { Auctioneer } from '@/types/auctioneer'
import { auctioneerToRow, rowToAuctioneer, type OrgAuctioneerRow } from './mappers'

export async function listByOrg(organizationId: string): Promise<Auctioneer[]> {
  const { data, error } = await supabase
    .from('org_auctioneers')
    .select('*')
    .eq('organization_id', organizationId)
    .order('license_issued_date', { ascending: true })

  if (error) throw error
  return (data as OrgAuctioneerRow[]).map(rowToAuctioneer)
}

export async function upsertOne(
  a: Auctioneer,
  ids: { organizationId: string; auctionOrgId: string | null },
): Promise<Auctioneer> {
  const { data, error } = await supabase
    .from('org_auctioneers')
    .upsert(auctioneerToRow(a, ids))
    .select()
    .single()

  if (error) throw error
  return rowToAuctioneer(data as OrgAuctioneerRow)
}

/**
 * Ghi hàng loạt sau khi đồng bộ từ Cổng Quốc gia.
 * onConflict theo (organization_id, license_number) — đúng dedupe key mà
 * merge.ts đang dùng, nên bản ghi crawl lại sẽ cập nhật chứ không nhân đôi.
 */
export async function upsertMany(
  list: Auctioneer[],
  ids: { organizationId: string; auctionOrgId: string | null },
): Promise<void> {
  if (list.length === 0) return
  const { error } = await supabase
    .from('org_auctioneers')
    .upsert(list.map((a) => auctioneerToRow(a, ids)), {
      onConflict: 'organization_id,license_number',
    })
  if (error) throw error
}

export async function removeOne(id: string): Promise<void> {
  const { error } = await supabase.from('org_auctioneers').delete().eq('id', id)
  if (error) throw error
}

/**
 * Nhập dữ liệu roster cũ từ localStorage. Bỏ qua bản trùng số thẻ thay vì ghi
 * đè: dữ liệu cũ không có ràng buộc UNIQUE nên có thể chứa trùng, và người
 * dùng bấm nhập lần hai không được phép làm hỏng bản đã chỉnh tay.
 */
export async function importLegacy(
  list: Auctioneer[],
  ids: { organizationId: string; auctionOrgId: string | null },
): Promise<{ imported: number; skipped: number }> {
  if (list.length === 0) return { imported: 0, skipped: 0 }

  // Bỏ trùng ngay trong chính mảng cũ trước khi gửi lên — Postgres không cho
  // ON CONFLICT xử lý hai dòng trùng nhau trong cùng một câu lệnh.
  const seen = new Set<string>()
  const deduped = list.filter((a) => {
    const key = a.licenseNumber.trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  const { data, error } = await supabase
    .from('org_auctioneers')
    .upsert(deduped.map((a) => auctioneerToRow({ ...a, id: '' }, ids)), {
      onConflict: 'organization_id,license_number',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) throw error
  const imported = data?.length ?? 0
  return { imported, skipped: list.length - imported }
}

// Truy cập dữ liệu bồi dưỡng ở phạm vi TỔ CHỨC.
//
// Khác dossier-repo.ts (đọc theo MỘT đấu giá viên): trang tổng hợp cần toàn bộ
// bản ghi bồi dưỡng của cả đội trong một lượt, nếu không sẽ thành N+1 query cho
// N đấu giá viên.

import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import type { CpdExemption, DossierEvent, EventType } from '@/types/personnel'

type EventRow = Database['public']['Tables']['org_auctioneer_events']['Row']
type ExemptionRow = Database['public']['Tables']['org_auctioneer_cpd_exemptions']['Row']

const d = (v: string | null): string | undefined => v ?? undefined
const orNull = (v: string | undefined | null): string | null => {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : null
}

function rowToEvent(r: EventRow): DossierEvent {
  return {
    id: r.id,
    auctioneerId: r.auctioneer_id,
    organizationId: r.organization_id,
    eventType: r.event_type as EventType,
    title: r.title,
    organizationName: d(r.organization_name),
    role: d(r.role),
    startedOn: d(r.started_on),
    endedOn: d(r.ended_on),
    referenceNo: d(r.reference_no),
    outcome: d(r.outcome),
    amount: r.amount === null ? undefined : Number(r.amount),
    hours: r.hours ?? undefined,
    notes: d(r.notes),
    attachments: r.attachments ?? [],
    isStateAuctionCenter: r.is_state_auction_center ?? false,
    cpdYear: r.cpd_year ?? undefined,
    cpdActivityTypeId: r.cpd_activity_type_id ?? undefined,
    cpdActivityRoleId: r.cpd_activity_role_id ?? undefined,
    sourceRecordId: d(r.source_record_id),
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function rowToExemption(r: ExemptionRow): CpdExemption {
  return {
    id: r.id,
    auctioneerId: r.auctioneer_id,
    organizationId: r.organization_id,
    year: r.year,
    reasonId: r.reason_id ?? '',
    note: d(r.note),
    filedAt: d(r.filed_at),
    attachments: r.attachments ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/**
 * Mọi sự kiện bồi dưỡng của tổ chức. Cố ý KHÔNG lọc theo năm ở tầng query: bản
 * ghi cũ có thể chưa được gán `cpd_year` và phải suy từ `started_on` (xem
 * `cpdEventYear`), lọc bằng SQL sẽ đánh rơi đúng nhóm đó.
 */
export async function listOrgTrainingEvents(organizationId: string): Promise<DossierEvent[]> {
  const { data, error } = await supabase
    .from('org_auctioneer_events')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('event_type', 'TRAINING')
    .order('started_on', { ascending: false, nullsFirst: false })
  if (error) throw error
  return (data as EventRow[]).map(rowToEvent)
}

export async function listExemptions(organizationId: string): Promise<CpdExemption[]> {
  const { data, error } = await supabase
    .from('org_auctioneer_cpd_exemptions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('year', { ascending: false })
  if (error) throw error
  return (data as ExemptionRow[]).map(rowToExemption)
}

/** Diện miễn của MỘT người, mọi năm — dùng ở hồ sơ cá nhân và lúc kết xuất. */
export async function listExemptionsForAuctioneer(auctioneerId: string): Promise<CpdExemption[]> {
  const { data, error } = await supabase
    .from('org_auctioneer_cpd_exemptions')
    .select('*')
    .eq('auctioneer_id', auctioneerId)
    .order('year', { ascending: false })
  if (error) throw error
  return (data as ExemptionRow[]).map(rowToExemption)
}

export async function upsertExemption(ex: Partial<CpdExemption> & {
  auctioneerId: string
  organizationId: string
  year: number
  reasonId: string
}): Promise<void> {
  const { error } = await supabase
    .from('org_auctioneer_cpd_exemptions')
    .upsert(
      {
        id: ex.id || undefined,
        auctioneer_id: ex.auctioneerId,
        organization_id: ex.organizationId,
        year: ex.year,
        reason_id: ex.reasonId,
        note: orNull(ex.note),
        filed_at: orNull(ex.filedAt),
        attachments: ex.attachments ?? [],
      },
      // Mỗi người mỗi năm một bản: đăng ký lại là SỬA bản cũ, không tạo bản trùng.
      { onConflict: 'auctioneer_id,year' },
    )
  if (error) throw error
}

export async function deleteExemption(id: string): Promise<void> {
  const { error } = await supabase.from('org_auctioneer_cpd_exemptions').delete().eq('id', id)
  if (error) throw error
}

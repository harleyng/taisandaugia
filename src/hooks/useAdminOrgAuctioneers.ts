// Đội ngũ đấu giá viên của một CÔNG TY ĐẤU GIÁ, đọc từ phía admin.
// Dùng chung cho cả Khách hàng (`/admin/khach-hang/:id`) lẫn Khách hàng tiềm
// năng (`/admin/khach-hang-tiem-nang/:id`).
//
// Không cần RPC: org_auctioneers / org_auctioneer_events /
// org_auctioneer_cpd_exemptions đều đã có policy `*_admin_all`
// (FOR ALL USING has_role(auth.uid(),'ADMIN')), nên typed client đọc thẳng được.
//
// Phần khó là NỐI bản ghi CRM với tổ chức. Lead trỏ thẳng bằng `prospect_id`;
// khách hàng thì `customers` KHÔNG có cột org_id nên phải thử lần lượt:
//   1. customers.prospect_id (prospect_kind='auction_org') → org_auctioneers.auction_org_id
//   2. customers.source_lead_id → leads.prospect_id → như trên
//   3. customers.user_id → organizations.owner_id → org_auctioneers.organization_id
// Không đường nào ra thì trả `resolvedVia = null` để UI nói rõ LÝ DO, thay vì
// hiện bảng rỗng khiến người đọc tưởng tổ chức chưa khai đấu giá viên.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import type { Auctioneer } from '@/types/auctioneer'
import type { CpdExemption, DossierEvent, EventType } from '@/types/personnel'
import { rowToAuctioneer } from '@/lib/auctioneers/mappers'

type EventRow = Database['public']['Tables']['org_auctioneer_events']['Row']
type ExemptionRow = Database['public']['Tables']['org_auctioneer_cpd_exemptions']['Row']
type AuctioneerRow = Database['public']['Tables']['org_auctioneers']['Row']

export type ResolvedVia = 'prospect' | 'lead_prospect' | 'owner_user' | null

/**
 * Nguồn để resolve. `auctionOrg` là đường trực tiếp (lead đã có sẵn
 * `prospect_id`); `customer` phải suy qua ba con trỏ trên bảng `customers`.
 */
export type AuctioneerSource =
  | { kind: 'customer'; id: string }
  | { kind: 'auctionOrg'; id: string }

export interface AdminOrgAuctioneers {
  resolvedVia: ResolvedVia
  auctioneers: Auctioneer[]
  eventsByPerson: Map<string, DossierEvent[]>
  exemptionsByPerson: Map<string, CpdExemption[]>
}

const d = (v: string | null): string | undefined => v ?? undefined

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

async function byAuctionOrg(auctionOrgId: string): Promise<AuctioneerRow[]> {
  const { data } = await supabase
    .from('org_auctioneers')
    .select('*')
    .eq('auction_org_id', auctionOrgId)
    .order('full_name')
  return (data ?? []) as AuctioneerRow[]
}

async function resolveAuctioneerRows(
  source: AuctioneerSource,
): Promise<{ via: ResolvedVia; rows: AuctioneerRow[] }> {
  if (source.kind === 'auctionOrg') {
    const rows = await byAuctionOrg(source.id)
    return { via: rows.length > 0 ? 'prospect' : null, rows }
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, prospect_id, prospect_kind, source_lead_id, user_id')
    .eq('id', source.id)
    .maybeSingle()
  if (!customer) return { via: null, rows: [] }

  // Đường 1 — con trỏ prospect nằm thẳng trên khách hàng.
  if (customer.prospect_id && customer.prospect_kind === 'auction_org') {
    const rows = await byAuctionOrg(customer.prospect_id)
    if (rows.length > 0) return { via: 'prospect', rows }
  }

  // Đường 2 — qua lead đã chuyển đổi (khách hàng cũ chưa có prospect_id).
  if (customer.source_lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('prospect_id, prospect_kind')
      .eq('id', customer.source_lead_id)
      .maybeSingle()
    if (lead?.prospect_id && lead.prospect_kind === 'auction_org') {
      const rows = await byAuctionOrg(lead.prospect_id)
      if (rows.length > 0) return { via: 'lead_prospect', rows }
    }
  }

  // Đường 3 — khách hàng chính là chủ sở hữu tổ chức đã KYC.
  if (customer.user_id) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', customer.user_id)
    const ids = (orgs ?? []).map((o) => o.id)
    if (ids.length > 0) {
      const { data } = await supabase
        .from('org_auctioneers')
        .select('*')
        .in('organization_id', ids)
        .order('full_name')
      if (data && data.length > 0) return { via: 'owner_user', rows: data as AuctioneerRow[] }
    }
  }

  return { via: null, rows: [] }
}

export function useAdminOrgAuctioneers(source: AuctioneerSource | null, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'auctioneers', source?.kind, source?.id],
    enabled: !!source && enabled,
    queryFn: async (): Promise<AdminOrgAuctioneers> => {
      const { via, rows } = await resolveAuctioneerRows(source!)
      const auctioneers = rows.map(rowToAuctioneer)
      const ids = auctioneers.map((a) => a.id)

      const eventsByPerson = new Map<string, DossierEvent[]>()
      const exemptionsByPerson = new Map<string, CpdExemption[]>()
      if (ids.length === 0) return { resolvedVia: via, auctioneers, eventsByPerson, exemptionsByPerson }

      const [{ data: events }, { data: exemptions }] = await Promise.all([
        supabase
          .from('org_auctioneer_events')
          .select('*')
          .in('auctioneer_id', ids)
          .order('started_on', { ascending: false, nullsFirst: false }),
        supabase
          .from('org_auctioneer_cpd_exemptions')
          .select('*')
          .in('auctioneer_id', ids)
          .order('year', { ascending: false }),
      ])

      for (const r of (events ?? []) as EventRow[]) {
        const ev = rowToEvent(r)
        const list = eventsByPerson.get(ev.auctioneerId)
        if (list) list.push(ev)
        else eventsByPerson.set(ev.auctioneerId, [ev])
      }

      for (const r of (exemptions ?? []) as ExemptionRow[]) {
        const x: CpdExemption = {
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
        const list = exemptionsByPerson.get(x.auctioneerId)
        if (list) list.push(x)
        else exemptionsByPerson.set(x.auctioneerId, [x])
      }

      return { resolvedVia: via, auctioneers, eventsByPerson, exemptionsByPerson }
    },
  })
}

// Truy cập hai bảng con của hồ sơ nhân sự.

import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import type {
  DocType, DossierEvent, EventType, PersonnelDocument,
} from '@/types/personnel'

type DocRow = Database['public']['Tables']['org_auctioneer_documents']['Row']
type EventRow = Database['public']['Tables']['org_auctioneer_events']['Row']

const d = (v: string | null): string | undefined => v ?? undefined
const orNull = (v: string | undefined | null): string | null => {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : null
}

function rowToDoc(r: DocRow): PersonnelDocument {
  return {
    id: r.id,
    auctioneerId: r.auctioneer_id,
    organizationId: r.organization_id,
    docType: r.doc_type as DocType,
    title: d(r.title),
    docNumber: d(r.doc_number),
    issuer: d(r.issuer),
    issuedDate: d(r.issued_date),
    expiryDate: d(r.expiry_date),
    filePaths: r.file_paths ?? [],
    notes: d(r.notes),
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
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

// ─── Giấy tờ ────────────────────────────────────────────────────────────────

export async function listDocuments(auctioneerId: string): Promise<PersonnelDocument[]> {
  const { data, error } = await supabase
    .from('org_auctioneer_documents')
    .select('*')
    .eq('auctioneer_id', auctioneerId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as DocRow[]).map(rowToDoc)
}

export async function upsertDocument(doc: Partial<PersonnelDocument> & {
  auctioneerId: string
  organizationId: string
  docType: DocType
}): Promise<void> {
  const { error } = await supabase.from('org_auctioneer_documents').upsert({
    id: doc.id || undefined,
    auctioneer_id: doc.auctioneerId,
    organization_id: doc.organizationId,
    doc_type: doc.docType,
    title: orNull(doc.title),
    doc_number: orNull(doc.docNumber),
    issuer: orNull(doc.issuer),
    issued_date: orNull(doc.issuedDate),
    expiry_date: orNull(doc.expiryDate),
    file_paths: doc.filePaths ?? [],
    notes: orNull(doc.notes),
    sort_order: doc.sortOrder ?? 0,
  })
  if (error) throw error
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('org_auctioneer_documents').delete().eq('id', id)
  if (error) throw error
}

// ─── Dòng thời gian ─────────────────────────────────────────────────────────

export async function listEvents(auctioneerId: string): Promise<DossierEvent[]> {
  const { data, error } = await supabase
    .from('org_auctioneer_events')
    .select('*')
    .eq('auctioneer_id', auctioneerId)
    .order('started_on', { ascending: false, nullsFirst: false })
  if (error) throw error
  return (data as EventRow[]).map(rowToEvent)
}

export async function upsertEvent(ev: Partial<DossierEvent> & {
  auctioneerId: string
  organizationId: string
  eventType: EventType
  title: string
}): Promise<void> {
  const { error } = await supabase.from('org_auctioneer_events').upsert({
    id: ev.id || undefined,
    auctioneer_id: ev.auctioneerId,
    organization_id: ev.organizationId,
    event_type: ev.eventType,
    title: ev.title,
    organization_name: orNull(ev.organizationName),
    role: orNull(ev.role),
    started_on: orNull(ev.startedOn),
    ended_on: orNull(ev.endedOn),
    reference_no: orNull(ev.referenceNo),
    outcome: orNull(ev.outcome),
    amount: ev.amount ?? null,
    hours: ev.hours ?? null,
    notes: orNull(ev.notes),
    attachments: ev.attachments ?? [],
    is_state_auction_center: ev.isStateAuctionCenter ?? false,
    // Chỉ sự kiện TRAINING mới mang ngữ nghĩa bồi dưỡng. Với các loại khác, ghi
    // null để không có dữ liệu rác bị engine đếm nhầm.
    cpd_year: ev.eventType === 'TRAINING' ? (ev.cpdYear ?? null) : null,
    cpd_activity_type_id: ev.eventType === 'TRAINING' ? (ev.cpdActivityTypeId ?? null) : null,
    cpd_activity_role_id: ev.eventType === 'TRAINING' ? (ev.cpdActivityRoleId ?? null) : null,
    source_record_id: orNull(ev.sourceRecordId),
    sort_order: ev.sortOrder ?? 0,
  })
  if (error) throw error
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('org_auctioneer_events').delete().eq('id', id)
  if (error) throw error
}

/**
 * Nhập cuộc đấu giá từ module Lịch sử đấu giá.
 * Bỏ qua bản đã nhập nhờ unique index (auctioneer_id, source_record_id) —
 * bấm nhập lần hai không nhân đôi dữ liệu.
 */
export async function importAuctionEvents(
  rows: Array<Omit<DossierEvent, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>>,
): Promise<number> {
  if (rows.length === 0) return 0
  const { data, error } = await supabase
    .from('org_auctioneer_events')
    .upsert(
      rows.map((ev) => ({
        auctioneer_id: ev.auctioneerId,
        organization_id: ev.organizationId,
        event_type: ev.eventType,
        title: ev.title,
        organization_name: orNull(ev.organizationName),
        started_on: orNull(ev.startedOn),
        reference_no: orNull(ev.referenceNo),
        outcome: orNull(ev.outcome),
        amount: ev.amount ?? null,
        attachments: [] as string[],
        source_record_id: orNull(ev.sourceRecordId),
      })),
      { onConflict: 'auctioneer_id,source_record_id', ignoreDuplicates: true },
    )
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

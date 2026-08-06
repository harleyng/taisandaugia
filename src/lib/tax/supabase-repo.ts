// Truy cập org_tax_records + org_tax_record_documents.
// Thay src/lib/tax/storage.ts (localStorage).

import { supabase } from '@/integrations/supabase/client'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'
import type { DocType, SupportingDocument, TaxRecord, TaxRecordType } from '@/types/tax'

type Row = Tables<'org_tax_records'>
type DocRow = Tables<'org_tax_record_documents'>

interface RowWithDocs extends Row {
  org_tax_record_documents?: DocRow[] | null
}

function rowToRecord(row: RowWithDocs): TaxRecord {
  return {
    id: row.id,
    year: row.year,
    recordType: row.record_type as TaxRecordType,
    // amount là NUMERIC(18,0) — supabase-js trả về string cho numeric để không
    // mất chính xác. Number() ở đây an toàn vì tiền VND còn xa Number.MAX_SAFE.
    amount: Number(row.amount),
    vatExcluded: row.vat_excluded,
    isFinalized: row.is_finalized,
    finalizedDate: row.finalized_date ?? undefined,
    supportingDocuments: (row.org_tax_record_documents ?? []).map(
      (d): SupportingDocument => ({
        docId: d.doc_id,
        docType: d.doc_type as DocType,
        fileName: d.file_name,
      }),
    ),
    notes: row.notes ?? undefined,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scoreContribution: row.score_contribution,
  }
}

function recordToRow(r: TaxRecord, organizationId: string): TablesInsert<'org_tax_records'> {
  return {
    id: r.id,
    organization_id: organizationId,
    year: r.year,
    record_type: r.recordType,
    amount: r.amount,
    vat_excluded: r.vatExcluded,
    is_finalized: r.isFinalized,
    finalized_date: r.finalizedDate ?? null,
    notes: r.notes ?? null,
    is_deleted: r.isDeleted,
    score_contribution: r.scoreContribution,
  }
}

const SELECT = '*, org_tax_record_documents(*)'

export async function listTaxRecords(organizationId: string): Promise<TaxRecord[]> {
  const { data, error } = await supabase
    .from('org_tax_records')
    .select(SELECT)
    .eq('organization_id', organizationId)
    .order('year', { ascending: false })
  if (error) throw error
  return (data as RowWithDocs[]).map(rowToRecord)
}

export async function upsertTaxRecord(
  record: TaxRecord,
  organizationId: string,
): Promise<void> {
  const { error } = await supabase.from('org_tax_records').upsert(recordToRow(record, organizationId))
  if (error) throw error

  // Thay toàn bộ danh sách giấy tờ kèm theo: xoá cái không còn, ghi lại cái mới.
  const { error: delErr } = await supabase
    .from('org_tax_record_documents')
    .delete()
    .eq('tax_record_id', record.id)
  if (delErr) throw delErr

  if (record.supportingDocuments.length === 0) return
  const { error: insErr } = await supabase.from('org_tax_record_documents').upsert(
    record.supportingDocuments.map((d) => ({
      tax_record_id: record.id,
      doc_id: d.docId,
      doc_type: d.docType,
      file_name: d.fileName,
    })),
    { onConflict: 'tax_record_id,doc_id' },
  )
  if (insErr) throw insErr
}

/** Xoá mềm — bản ghi thuế là dữ liệu kế toán, phải đối chiếu lại được. */
export async function softDeleteTaxRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('org_tax_records')
    .update({ is_deleted: true })
    .eq('id', id)
  if (error) throw error
}

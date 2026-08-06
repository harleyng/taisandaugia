// Đọc/ghi danh mục bồi dưỡng. Đọc mở cho mọi vai (RLS `USING (true)`), ghi chỉ
// ADMIN — danh mục là từ điển nhãn dùng chung cho cả portal lẫn hồ sơ kết xuất.

import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import type {
  CpdActivityRole, CpdActivityType, CpdCatalog, CpdCreditMode, CpdExemptionReasonDef,
} from '@/types/cpd-catalog'

type TypeRow = Database['public']['Tables']['cpd_activity_types']['Row']
type RoleRow = Database['public']['Tables']['cpd_activity_roles']['Row']
type ReasonRow = Database['public']['Tables']['cpd_exemption_reasons']['Row']

const d = (v: string | null): string | undefined => v ?? undefined
const num = (v: number | string | null): number | undefined =>
  v === null ? undefined : Number(v)
const orNull = (v: string | undefined | null): string | null => {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : null
}

const rowToRole = (r: RoleRow): CpdActivityRole => ({
  id: r.id,
  activityTypeId: r.activity_type_id,
  code: r.code,
  name: r.name,
  description: d(r.description),
  creditMode: r.credit_mode as CpdCreditMode,
  fixedHours: num(r.fixed_hours),
  sortOrder: r.sort_order,
  isActive: r.is_active,
})

const rowToType = (r: TypeRow, roles: RoleRow[]): CpdActivityType => ({
  id: r.id,
  code: r.code,
  name: r.name,
  description: d(r.description),
  legalBasis: d(r.legal_basis),
  hasRoles: r.has_roles,
  creditMode: r.credit_mode as CpdCreditMode,
  fixedHours: num(r.fixed_hours),
  titleLabel: r.title_label,
  orgLabel: r.org_label,
  evidenceHint: d(r.evidence_hint),
  sortOrder: r.sort_order,
  isActive: r.is_active,
  roles: roles
    .filter((x) => x.activity_type_id === r.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(rowToRole),
})

const rowToReason = (r: ReasonRow): CpdExemptionReasonDef => ({
  id: r.id,
  code: r.code,
  name: r.name,
  description: d(r.description),
  legalBasis: d(r.legal_basis),
  requiresEvidence: r.requires_evidence,
  sortOrder: r.sort_order,
  isActive: r.is_active,
})

/**
 * CỐ Ý KHÔNG lọc `is_active`: danh mục còn phải giải nghĩa bản ghi lịch sử. Lọc
 * ở điểm chọn (`selectableTypes` trong cpd-catalog.ts), không lọc ở đây.
 */
export async function fetchCatalog(): Promise<CpdCatalog> {
  const [types, roles, reasons] = await Promise.all([
    supabase.from('cpd_activity_types').select('*').order('sort_order'),
    supabase.from('cpd_activity_roles').select('*').order('sort_order'),
    supabase.from('cpd_exemption_reasons').select('*').order('sort_order'),
  ])
  if (types.error) throw types.error
  if (roles.error) throw roles.error
  if (reasons.error) throw reasons.error

  const roleRows = (roles.data ?? []) as RoleRow[]
  return {
    activityTypes: ((types.data ?? []) as TypeRow[]).map((t) => rowToType(t, roleRows)),
    exemptionReasons: ((reasons.data ?? []) as ReasonRow[]).map(rowToReason),
  }
}

// ─── Ghi (ADMIN) ────────────────────────────────────────────────────────────

export type ActivityTypeInput = Omit<CpdActivityType, 'id' | 'roles'> & { id?: string }
export type ActivityRoleInput = Omit<CpdActivityRole, 'id'> & { id?: string }
export type ExemptionReasonInput = Omit<CpdExemptionReasonDef, 'id'> & { id?: string }

export async function upsertActivityType(v: ActivityTypeInput): Promise<void> {
  const { error } = await supabase.from('cpd_activity_types').upsert({
    id: v.id || undefined,
    code: v.code.trim().toUpperCase(),
    name: v.name.trim(),
    description: orNull(v.description),
    legal_basis: orNull(v.legalBasis),
    has_roles: v.hasRoles,
    credit_mode: v.creditMode,
    // Quy đổi cố định chỉ có nghĩa khi tính giờ và không phân vai trò — dọn ở
    // tầng ghi để dữ liệu không giữ số mồ côi gây hiểu nhầm khi đọc lại.
    fixed_hours: !v.hasRoles && v.creditMode === 'HOURS' ? (v.fixedHours ?? null) : null,
    title_label: v.titleLabel.trim() || 'Tên hoạt động',
    org_label: v.orgLabel.trim() || 'Đơn vị tổ chức',
    evidence_hint: orNull(v.evidenceHint),
    sort_order: v.sortOrder,
    is_active: v.isActive,
  })
  if (error) throw error
}

export async function upsertActivityRole(v: ActivityRoleInput): Promise<void> {
  const { error } = await supabase.from('cpd_activity_roles').upsert({
    id: v.id || undefined,
    activity_type_id: v.activityTypeId,
    code: v.code.trim().toUpperCase(),
    name: v.name.trim(),
    description: orNull(v.description),
    credit_mode: v.creditMode,
    fixed_hours: v.creditMode === 'HOURS' ? (v.fixedHours ?? null) : null,
    sort_order: v.sortOrder,
    is_active: v.isActive,
  })
  if (error) throw error
}

export async function upsertExemptionReason(v: ExemptionReasonInput): Promise<void> {
  const { error } = await supabase.from('cpd_exemption_reasons').upsert({
    id: v.id || undefined,
    code: v.code.trim().toUpperCase(),
    name: v.name.trim(),
    description: orNull(v.description),
    legal_basis: orNull(v.legalBasis),
    requires_evidence: v.requiresEvidence,
    sort_order: v.sortOrder,
    is_active: v.isActive,
  })
  if (error) throw error
}

// Xoá chỉ đi được khi chưa ai dùng — FK ON DELETE RESTRICT sẽ chặn. Lỗi 23503
// dịch sang tiếng Việt ở tầng hook để admin biết phải TẮT thay vì xoá.
export async function deleteActivityType(id: string): Promise<void> {
  const { error } = await supabase.from('cpd_activity_types').delete().eq('id', id)
  if (error) throw error
}

export async function deleteActivityRole(id: string): Promise<void> {
  const { error } = await supabase.from('cpd_activity_roles').delete().eq('id', id)
  if (error) throw error
}

export async function deleteExemptionReason(id: string): Promise<void> {
  const { error } = await supabase.from('cpd_exemption_reasons').delete().eq('id', id)
  if (error) throw error
}

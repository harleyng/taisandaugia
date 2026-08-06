// Truy cập org_applications (+ criteria, exports) và org_capacity_profile.
// Thay phần localStorage của src/lib/applications/storage.ts.

import { supabase } from '@/integrations/supabase/client'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'
import type {
  Announcement,
  Application,
  ApplicationStatus,
  AssetCategory,
  CriterionNature,
  ExportFormat,
  ExportedFile,
  SectionVCriterion,
} from '@/types/application'
import type { CapacityProfile } from '@/types/capacity-profile'

type AppRow = Tables<'org_applications'>
type CritRow = Tables<'org_application_criteria'>
type ExpRow = Tables<'org_application_exports'>
type CapRow = Tables<'org_capacity_profile'>

interface AppRowFull extends AppRow {
  org_application_criteria?: CritRow[] | null
  org_application_exports?: ExpRow[] | null
}

/** Tiêu đề hiển thị. Bản localStorage tính khi lưu; nay suy khi đọc để không có
 *  cột dẫn xuất lệch với nguồn. */
const CATEGORY_ABBR: Partial<Record<string, string>> = {
  LAND_USE_RIGHT: 'QSDĐ',
  ADMIN_VIOLATION: 'Tang vật',
  ENFORCEMENT: 'THA',
  MACHINERY: 'Máy móc',
  VEHICLE: 'Phương tiện',
}

export function applicationTitle(app: Pick<Application, 'name' | 'announcement'>): string {
  const a = app.announcement
  const short =
    a.assetCategory && a.province
      ? `${CATEGORY_ABBR[a.assetCategory] ?? 'Tài sản'} ${a.province}`
      : a.assetDescription
  return app.name?.trim() || short || 'Hồ sơ chưa đặt tên'
}

export type ApplicationListItem = Pick<
  Application,
  'id' | 'status' | 'createdAt' | 'updatedAt'
> & {
  title: string
  ownerName: string
  deadline: string
  totalScore: number
  /** Có trong list để modal "Sao chép từ hồ sơ trước" khỏi phải nạp từng hồ sơ
   *  đầy đủ chỉ để đọc một trường — trên localStorage rẻ, qua mạng thì thành
   *  N lượt gọi mỗi lần render. */
  assetCategory: AssetCategory | ''
}

const u = (v: string | null) => v ?? undefined
const num = (v: string | number | null) => (v === null ? 0 : Number(v))

function rowToAnnouncement(r: AppRow): Announcement {
  return {
    ownerName: r.ann_owner_name,
    assetDescription: r.ann_asset_description,
    // '' ở type UI nghĩa là "chưa chọn" — ánh xạ ngược từ NULL.
    assetCategory: (r.ann_asset_category ?? '') as AssetCategory | '',
    startingPrice: r.ann_starting_price === null ? '' : Number(r.ann_starting_price),
    assetLocation: r.ann_asset_location,
    province: r.ann_province,
    deadline: r.ann_deadline ?? '',
    announcementUrl: r.ann_url ?? '',
    announcementNumber: r.ann_number ?? '',
    announcementDate: r.ann_date ?? '',
  }
}

export function rowToApplication(r: AppRowFull): Application {
  return {
    id: r.id,
    orgId: r.organization_id,
    name: u(r.name),
    announcement: rowToAnnouncement(r),
    capacitySnapshot: {
      scoreI: num(r.cap_score_i),
      scoreII: num(r.cap_score_ii),
      scoreIV1to4: num(r.cap_score_iv_1_to_4),
      scoreIV5: num(r.cap_score_iv_5),
      scoreIV6to8: num(r.cap_score_iv_6_to_8),
      scoreIV9: num(r.cap_score_iv_9),
      totalCapacityScore: num(r.cap_total_score),
      warnings: r.cap_warnings ?? [],
      snapshotAt: r.cap_snapshot_at ?? '',
    },
    auctionPlan: {
      format: r.plan_format,
      receptionPlan: r.plan_reception_plan,
      participantConditions: r.plan_participant_conditions,
      antiCollusionMeasures: r.plan_anti_collusion_measures,
      score: num(r.plan_score),
    },
    sectionVCriteria: (r.org_application_criteria ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (c): SectionVCriterion => ({
          id: c.criterion_key,
          label: c.label,
          maxPoints: num(c.max_points),
          nature: c.nature as CriterionNature,
          natureAutoDetected: c.nature_auto_detected,
          // BOOLEAN NULL giữ đúng nghĩa "chưa đánh giá", khác "không đạt".
          meets: c.meets,
          evidence: c.evidence,
          attachedDocIds: c.attached_doc_ids ?? [],
          autoMatchResult:
            c.auto_match_matched === null
              ? undefined
              : { matched: c.auto_match_matched, matchedItems: c.auto_match_items ?? [] },
        }),
      ),
    sectionVScore: num(r.section_v_score),
    exportFormat: (r.export_format as ExportFormat | null) ?? null,
    totalScore: num(r.total_score),
    status: r.status as ApplicationStatus,
    exportedFiles: (r.org_application_exports ?? [])
      .slice()
      .sort((a, b) => (a.exported_at < b.exported_at ? 1 : -1))
      .map((e): ExportedFile => ({ url: e.url, name: e.name, exportedAt: e.exported_at })),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const d = (v?: string) => (v && v.trim() ? v : null)

function appToRow(app: Application, organizationId: string): TablesInsert<'org_applications'> {
  const a = app.announcement
  return {
    id: app.id,
    organization_id: organizationId,
    name: app.name ?? null,
    status: app.status,

    ann_owner_name: a.ownerName,
    ann_asset_description: a.assetDescription,
    ann_asset_category: a.assetCategory === '' ? null : a.assetCategory,
    ann_starting_price: a.startingPrice === '' ? null : a.startingPrice,
    ann_asset_location: a.assetLocation,
    ann_province: a.province,
    ann_deadline: d(a.deadline),
    ann_url: a.announcementUrl || null,
    ann_number: a.announcementNumber || null,
    ann_date: d(a.announcementDate),

    cap_score_i: app.capacitySnapshot.scoreI,
    cap_score_ii: app.capacitySnapshot.scoreII,
    cap_score_iv_1_to_4: app.capacitySnapshot.scoreIV1to4,
    cap_score_iv_5: app.capacitySnapshot.scoreIV5,
    cap_score_iv_6_to_8: app.capacitySnapshot.scoreIV6to8,
    cap_score_iv_9: app.capacitySnapshot.scoreIV9,
    cap_total_score: app.capacitySnapshot.totalCapacityScore,
    cap_warnings: app.capacitySnapshot.warnings,
    cap_snapshot_at: app.capacitySnapshot.snapshotAt || null,

    plan_format: app.auctionPlan.format,
    plan_reception_plan: app.auctionPlan.receptionPlan,
    plan_participant_conditions: app.auctionPlan.participantConditions,
    plan_anti_collusion_measures: app.auctionPlan.antiCollusionMeasures,
    plan_score: app.auctionPlan.score,

    section_v_score: app.sectionVScore,
    total_score: app.totalScore,
    export_format: app.exportFormat,
  }
}

const SELECT = '*, org_application_criteria(*), org_application_exports(*)'

export async function listApplications(organizationId: string): Promise<ApplicationListItem[]> {
  // Chỉ lấy cột cần cho danh sách — hồ sơ đầy đủ có tới hàng chục trường text dài.
  const { data, error } = await supabase
    .from('org_applications')
    .select(
      'id, status, created_at, updated_at, name, total_score, ann_owner_name, ann_deadline, ann_asset_category, ann_province, ann_asset_description',
    )
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status as ApplicationStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    title: applicationTitle({
      name: r.name ?? undefined,
      announcement: {
        assetCategory: (r.ann_asset_category ?? '') as AssetCategory | '',
        province: r.ann_province,
        assetDescription: r.ann_asset_description,
      } as Announcement,
    }),
    ownerName: r.ann_owner_name ?? '',
    deadline: r.ann_deadline ?? '',
    totalScore: num(r.total_score),
    assetCategory: (r.ann_asset_category ?? '') as AssetCategory | '',
  }))
}

export async function getApplication(id: string): Promise<Application | null> {
  const { data, error } = await supabase.from('org_applications').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToApplication(data as AppRowFull) : null
}

export async function saveApplication(app: Application, organizationId: string): Promise<void> {
  const { error } = await supabase.from('org_applications').upsert(appToRow(app, organizationId))
  if (error) throw error

  // Tiêu chí mục V: thay toàn bộ (số lượng nhỏ, cố định theo bộ tiêu chí).
  const { error: delC } = await supabase
    .from('org_application_criteria')
    .delete()
    .eq('application_id', app.id)
  if (delC) throw delC

  if (app.sectionVCriteria.length > 0) {
    const { error: insC } = await supabase.from('org_application_criteria').insert(
      app.sectionVCriteria.map((c, idx) => ({
        application_id: app.id,
        criterion_key: c.id,
        label: c.label,
        max_points: c.maxPoints,
        nature: c.nature,
        nature_auto_detected: c.natureAutoDetected,
        meets: c.meets,
        evidence: c.evidence,
        attached_doc_ids: c.attachedDocIds,
        auto_match_matched: c.autoMatchResult?.matched ?? null,
        auto_match_items: c.autoMatchResult?.matchedItems ?? [],
        sort_order: idx,
      })),
    )
    if (insC) throw insC
  }

  // File đã xuất: CHỈ THÊM, không xoá — đây là lịch sử xuất bản, mất là mất
  // bằng chứng đã nộp gì vào lúc nào.
  if (app.exportedFiles.length > 0) {
    const { data: existing } = await supabase
      .from('org_application_exports')
      .select('url')
      .eq('application_id', app.id)
    const known = new Set((existing ?? []).map((e) => e.url))
    const fresh = app.exportedFiles.filter((f) => !known.has(f.url))
    if (fresh.length > 0) {
      const { error: insE } = await supabase.from('org_application_exports').insert(
        fresh.map((f) => ({
          application_id: app.id,
          url: f.url,
          name: f.name,
          exported_at: f.exportedAt,
        })),
      )
      if (insE) throw insE
    }
  }
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase.from('org_applications').delete().eq('id', id)
  if (error) throw error
}

// ─── Hồ sơ năng lực tổng hợp ─────────────────────────────────────────────────

export function rowToCapacityProfile(r: CapRow): CapacityProfile {
  return {
    companyName: r.company_name ?? undefined,
    onMinistryList: r.on_ministry_list,
    scoreII: num(r.score_ii),
    scoreIV1to4: num(r.score_iv_1_to_4),
    auctionsCompleted: r.auctions_completed,
    auctionsMissingPrice: r.auctions_missing_price,
    scoreIV5: num(r.score_iv_5),
    yearsActive: num(r.years_active),
    scoreIV6to8: num(r.score_iv_6_to_8),
    auctioneerCount: r.auctioneer_count,
    scoreIV9: num(r.score_iv_9),
    taxPaidPreviousYear: num(r.tax_paid_previous_year),
    totalCapacityScore: num(r.total_capacity_score),
    warnings: r.warnings ?? [],
  }
}

export async function getCapacityProfile(organizationId: string): Promise<CapacityProfile | null> {
  const { data, error } = await supabase
    .from('org_capacity_profile')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) throw error
  return data ? rowToCapacityProfile(data as CapRow) : null
}

export async function saveCapacityProfile(
  p: CapacityProfile,
  organizationId: string,
): Promise<void> {
  const { error } = await supabase.from('org_capacity_profile').upsert(
    {
      organization_id: organizationId,
      company_name: p.companyName ?? null,
      on_ministry_list: p.onMinistryList,
      score_ii: p.scoreII,
      score_iv_1_to_4: p.scoreIV1to4,
      auctions_completed: p.auctionsCompleted,
      auctions_missing_price: p.auctionsMissingPrice,
      score_iv_5: p.scoreIV5,
      years_active: p.yearsActive,
      score_iv_6_to_8: p.scoreIV6to8,
      auctioneer_count: p.auctioneerCount,
      score_iv_9: p.scoreIV9,
      tax_paid_previous_year: p.taxPaidPreviousYear,
      total_capacity_score: p.totalCapacityScore,
      warnings: p.warnings,
    },
    { onConflict: 'organization_id' },
  )
  if (error) throw error
}

// Truy cập org_infrastructure + org_infrastructure_photos.
// Thay src/lib/infrastructure/storage.ts (localStorage).
//
// Bảy mục của Infrastructure được LÀM PHẲNG thành cột có tiền tố ở DB. Mapper
// dưới đây là chỗ duy nhất biết quy ước đó — phần còn lại của app vẫn thấy cấu
// trúc lồng như cũ.

import { supabase } from '@/integrations/supabase/client'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'
import type {
  Archive,
  CameraAtAuction,
  CameraSystem,
  Headquarters,
  Infrastructure,
  OnlineAuctionPlatform,
  PhotoAttachment,
  ReceptionPoint,
  Website,
} from '@/types/infrastructure'

type Row = Tables<'org_infrastructure'>
type PhotoRow = Tables<'org_infrastructure_photos'>

/** Khoá mục ở DB ↔ tên trường trong type Infrastructure. */
const SECTIONS = {
  headquarters: 'headquarters',
  reception_point: 'receptionPoint',
  camera_at_office: 'cameraAtOffice',
  camera_at_auction: 'cameraAtAuction',
  website: 'website',
  online_platform: 'onlineAuctionPlatform',
  archive: 'archive',
} as const

export type DbSection = keyof typeof SECTIONS

const u = (v: string | null) => v ?? undefined
const n = (v: string | number | null) => (v === null ? undefined : Number(v))

function rowToPhoto(r: PhotoRow): PhotoAttachment {
  return {
    id: r.id,
    documentId: r.document_id ?? '',
    storagePath: r.storage_path,
    fileName: r.file_name,
    fileSize: Number(r.file_size),
    uploadedAt: r.uploaded_at,
    caption: u(r.caption),
    takenAt: u(r.taken_at),
    width: r.width,
    height: r.height,
  }
}

function photosOf(photos: PhotoRow[], section: DbSection): PhotoAttachment[] {
  return photos.filter((p) => p.section === section).map(rowToPhoto)
}

export function rowToInfrastructure(row: Row, photos: PhotoRow[]): Infrastructure {
  const headquarters: Headquarters = {
    address: row.hq_address,
    ward: row.hq_ward,
    district: row.hq_district,
    province: row.hq_province,
    phone: row.hq_phone,
    email: row.hq_email,
    workingArea: n(row.hq_working_area),
    floorCount: n(row.hq_floor_count),
    isOwned: row.hq_is_owned,
    leaseEndDate: u(row.hq_lease_end_date),
    photos: photosOf(photos, 'headquarters'),
    lastUpdatedAt: row.hq_last_updated_at,
  }

  const receptionPoint: ReceptionPoint = {
    isAtHeadquarters: row.rp_is_at_headquarters,
    address: u(row.rp_address),
    workingHours: row.rp_working_hours,
    workingDays: row.rp_working_days ?? [],
    publicNoticeMethod: row.rp_public_notice_method,
    photos: photosOf(photos, 'reception_point'),
    lastUpdatedAt: row.rp_last_updated_at,
  }

  const cameraAtOffice: CameraSystem = {
    hasSystem: row.cam_office_has_system,
    locations: row.cam_office_locations ?? [],
    canExtractRecording: row.cam_office_can_extract_recording,
    canStoreWithCase: row.cam_office_can_store_with_case,
    technicalNotes: u(row.cam_office_technical_notes),
    photos: photosOf(photos, 'camera_at_office'),
    lastUpdatedAt: row.cam_office_last_updated_at,
  }

  const cameraAtAuction: CameraAtAuction = {
    hasSystem: row.cam_auction_has_system,
    isSameAsOffice: row.cam_auction_is_same_as_office,
    locations: row.cam_auction_locations ?? [],
    canExtractRecording: row.cam_auction_can_extract_recording,
    canStoreWithCase: row.cam_auction_can_store_with_case,
    technicalNotes: u(row.cam_auction_technical_notes),
    photos: photosOf(photos, 'camera_at_auction'),
    lastUpdatedAt: row.cam_auction_last_updated_at,
  }

  const website: Website = {
    type: row.web_type as Website['type'],
    url: row.web_url,
    isReachable: row.web_is_reachable ?? undefined,
    lastChecked: u(row.web_last_checked),
    hasRegularUpdates: row.web_has_regular_updates,
    lastContentUpdateDate: u(row.web_last_content_update_date),
    screenshots: photosOf(photos, 'website'),
    lastUpdatedAt: row.web_last_updated_at,
  }

  const onlineAuctionPlatform: OnlineAuctionPlatform = {
    qualificationType: row.oap_qualification_type as OnlineAuctionPlatform['qualificationType'],
    approvalDocumentNumber: u(row.oap_approval_document_number),
    approvalDate: u(row.oap_approval_date),
    approvedBy: u(row.oap_approved_by),
    approvalDocument: u(row.oap_approval_document),
    url: u(row.oap_url),
    isOwnPlatform: row.oap_is_own_platform ?? undefined,
    platformProvider: u(row.oap_platform_provider),
    lastYearOnlineAuctionCount: n(row.oap_last_year_auction_count),
    screenshots: photosOf(photos, 'online_platform'),
    lastUpdatedAt: row.oap_last_updated_at,
  }

  const archive: Archive = {
    isAtHeadquarters: row.ar_is_at_headquarters,
    address: u(row.ar_address),
    area: n(row.ar_area),
    storageType: row.ar_storage_type as Archive['storageType'],
    securityMeasures: row.ar_security_measures ?? [],
    photos: photosOf(photos, 'archive'),
    lastUpdatedAt: row.ar_last_updated_at,
  }

  return {
    id: row.id,
    orgId: row.organization_id,
    headquarters,
    receptionPoint,
    cameraAtOffice,
    cameraAtAuction,
    website,
    onlineAuctionPlatform,
    archive,
    totalScore: Number(row.total_score),
    scoreBreakdown: {
      II_1_1: Number(row.score_ii_1_1),
      II_1_2: Number(row.score_ii_1_2),
      II_2_1: Number(row.score_ii_2_1),
      II_2_2: Number(row.score_ii_2_2),
      II_3: Number(row.score_ii_3),
      II_4: Number(row.score_ii_4),
      II_5: Number(row.score_ii_5),
    },
    completionPercentage: row.completion_percentage,
    sectionsNeedingUpdate: row.sections_needing_update ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Chuỗi ngày rỗng phải thành NULL — cột DATE không nhận ''. */
const d = (v?: string) => (v && v.trim() ? v : null)

function infraToRow(i: Infrastructure, organizationId: string): TablesInsert<'org_infrastructure'> {
  return {
    organization_id: organizationId,

    hq_address: i.headquarters.address,
    hq_ward: i.headquarters.ward,
    hq_district: i.headquarters.district,
    hq_province: i.headquarters.province,
    hq_phone: i.headquarters.phone,
    hq_email: i.headquarters.email,
    hq_working_area: i.headquarters.workingArea ?? null,
    hq_floor_count: i.headquarters.floorCount ?? null,
    hq_is_owned: i.headquarters.isOwned,
    hq_lease_end_date: d(i.headquarters.leaseEndDate),
    hq_last_updated_at: i.headquarters.lastUpdatedAt,

    rp_is_at_headquarters: i.receptionPoint.isAtHeadquarters,
    rp_address: i.receptionPoint.address ?? null,
    rp_working_hours: i.receptionPoint.workingHours,
    rp_working_days: i.receptionPoint.workingDays,
    rp_public_notice_method: i.receptionPoint.publicNoticeMethod,
    rp_last_updated_at: i.receptionPoint.lastUpdatedAt,

    cam_office_has_system: i.cameraAtOffice.hasSystem,
    cam_office_locations: i.cameraAtOffice.locations,
    cam_office_can_extract_recording: i.cameraAtOffice.canExtractRecording,
    cam_office_can_store_with_case: i.cameraAtOffice.canStoreWithCase,
    cam_office_technical_notes: i.cameraAtOffice.technicalNotes ?? null,
    cam_office_last_updated_at: i.cameraAtOffice.lastUpdatedAt,

    cam_auction_has_system: i.cameraAtAuction.hasSystem,
    cam_auction_is_same_as_office: i.cameraAtAuction.isSameAsOffice,
    cam_auction_locations: i.cameraAtAuction.locations,
    cam_auction_can_extract_recording: i.cameraAtAuction.canExtractRecording,
    cam_auction_can_store_with_case: i.cameraAtAuction.canStoreWithCase,
    cam_auction_technical_notes: i.cameraAtAuction.technicalNotes ?? null,
    cam_auction_last_updated_at: i.cameraAtAuction.lastUpdatedAt,

    web_type: i.website.type,
    web_url: i.website.url,
    web_is_reachable: i.website.isReachable ?? null,
    web_last_checked: i.website.lastChecked ?? null,
    web_has_regular_updates: i.website.hasRegularUpdates,
    web_last_content_update_date: d(i.website.lastContentUpdateDate),
    web_last_updated_at: i.website.lastUpdatedAt,

    oap_qualification_type: i.onlineAuctionPlatform.qualificationType,
    oap_approval_document_number: i.onlineAuctionPlatform.approvalDocumentNumber ?? null,
    oap_approval_date: d(i.onlineAuctionPlatform.approvalDate),
    oap_approved_by: i.onlineAuctionPlatform.approvedBy ?? null,
    oap_approval_document: i.onlineAuctionPlatform.approvalDocument ?? null,
    oap_url: i.onlineAuctionPlatform.url ?? null,
    oap_is_own_platform: i.onlineAuctionPlatform.isOwnPlatform ?? null,
    oap_platform_provider: i.onlineAuctionPlatform.platformProvider ?? null,
    oap_last_year_auction_count: i.onlineAuctionPlatform.lastYearOnlineAuctionCount ?? null,
    oap_last_updated_at: i.onlineAuctionPlatform.lastUpdatedAt,

    ar_is_at_headquarters: i.archive.isAtHeadquarters,
    ar_address: i.archive.address ?? null,
    ar_area: i.archive.area ?? null,
    ar_storage_type: i.archive.storageType,
    ar_security_measures: i.archive.securityMeasures,
    ar_last_updated_at: i.archive.lastUpdatedAt,

    total_score: i.totalScore,
    score_ii_1_1: i.scoreBreakdown.II_1_1,
    score_ii_1_2: i.scoreBreakdown.II_1_2,
    score_ii_2_1: i.scoreBreakdown.II_2_1,
    score_ii_2_2: i.scoreBreakdown.II_2_2,
    score_ii_3: i.scoreBreakdown.II_3,
    score_ii_4: i.scoreBreakdown.II_4,
    score_ii_5: i.scoreBreakdown.II_5,
    completion_percentage: Math.max(0, Math.min(100, Math.round(i.completionPercentage))),
    sections_needing_update: i.sectionsNeedingUpdate,
  }
}

export async function getInfrastructure(organizationId: string): Promise<Infrastructure | null> {
  const { data, error } = await supabase
    .from('org_infrastructure')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const { data: photos, error: pErr } = await supabase
    .from('org_infrastructure_photos')
    .select('*')
    .eq('infrastructure_id', (data as Row).id)
    .order('sort_order')
  if (pErr) throw pErr

  return rowToInfrastructure(data as Row, (photos ?? []) as PhotoRow[])
}

export async function saveInfrastructure(
  infra: Infrastructure,
  organizationId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('org_infrastructure')
    .upsert(infraToRow(infra, organizationId), { onConflict: 'organization_id' })
    .select('id')
    .single()
  if (error) throw error

  const infraId = (data as { id: string }).id

  // Ảnh: thay toàn bộ. Đơn giản và luôn nhất quán với state trên UI; số ảnh của
  // một tổ chức nhỏ nên chi phí không đáng kể.
  const { error: delErr } = await supabase
    .from('org_infrastructure_photos')
    .delete()
    .eq('infrastructure_id', infraId)
  if (delErr) throw delErr

  const rows: TablesInsert<'org_infrastructure_photos'>[] = []
  const push = (section: DbSection, list: PhotoAttachment[]) =>
    list.forEach((p, idx) =>
      rows.push({
        infrastructure_id: infraId,
        section,
        document_id: p.documentId || null,
        storage_path: p.storagePath,
        file_name: p.fileName,
        file_size: p.fileSize,
        caption: p.caption ?? null,
        taken_at: p.takenAt ?? null,
        width: p.width,
        height: p.height,
        sort_order: idx,
        uploaded_at: p.uploadedAt,
      }),
    )

  push('headquarters', infra.headquarters.photos)
  push('reception_point', infra.receptionPoint.photos)
  push('camera_at_office', infra.cameraAtOffice.photos)
  push('camera_at_auction', infra.cameraAtAuction.photos)
  push('website', infra.website.screenshots)
  push('online_platform', infra.onlineAuctionPlatform.screenshots)
  push('archive', infra.archive.photos)

  if (rows.length === 0) return
  const { error: insErr } = await supabase.from('org_infrastructure_photos').insert(rows)
  if (insErr) throw insErr
}

// Ánh xạ snake_case (Postgres) ↔ camelCase (TS) cho đấu giá viên.
//
// Viết tay thay vì dùng converter tổng quát vì hai lý do: field_sources /
// overrides là jsonb cần ép kiểu có chủ đích, và cột DATE của Postgres trả về
// 'YYYY-MM-DD' trong khi phía TS vẫn dùng chuỗi ISO — không được để converter
// tự đoán.

import type { Database } from '@/integrations/supabase/types'
import type {
  Auctioneer,
  ContractType,
  DataSource,
  FieldSource,
  OverrideRecord,
  Position,
  PublicFieldKey,
} from '@/types/auctioneer'
import { makeDefaultFieldSources } from '@/types/auctioneer'
import type { Json } from '@/integrations/supabase/types'

export type OrgAuctioneerRow = Database['public']['Tables']['org_auctioneers']['Row']
export type OrgAuctioneerInsert = Database['public']['Tables']['org_auctioneers']['Insert']

/** Cột DATE ('YYYY-MM-DD') → chuỗi form dùng được, giữ nguyên rỗng thành undefined. */
const d = (v: string | null): string | undefined => v ?? undefined

/** Chuỗi rỗng phải thành NULL, không thành '' — tránh làm hỏng CHECK/UNIQUE. */
const orNull = (v: string | undefined | null): string | null => {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : null
}

export function rowToAuctioneer(row: OrgAuctioneerRow): Auctioneer {
  return {
    id: row.id,
    orgId: row.organization_id,

    source: row.source as DataSource,
    crawledAt: d(row.crawled_at),
    crawledFromUrl: d(row.crawled_from_url),
    isVerifiedByPublicSource: row.is_verified_by_public_source,

    fullName: row.full_name,
    dateOfBirth: d(row.date_of_birth),
    permanentAddress: d(row.permanent_address),
    professionalCertNumber: row.professional_cert_number,
    professionalCertIssuedDate: d(row.professional_cert_issued_date),
    licenseNumber: row.license_number,
    licenseIssuedDate: row.license_issued_date,
    joinedDate: row.joined_date,

    fieldSources:
      (row.field_sources as Record<PublicFieldKey, FieldSource> | null) ??
      makeDefaultFieldSources('USER'),
    overrides: (row.overrides as unknown as OverrideRecord[] | null) ?? [],

    position: row.position as Position,
    contractType: row.contract_type as ContractType,
    licenseExpiryDate: d(row.license_expiry_date),
    email: d(row.email),
    phone: d(row.phone),
    internalNotes: d(row.internal_notes),
    endedDate: d(row.ended_date),
    isActive: row.is_active,

    attachedDocuments: row.attached_documents ?? [],

    idNumber: d(row.id_number),
    idType: (row.id_type as 'CCCD' | 'PASSPORT' | null) ?? undefined,
    idIssuedDate: d(row.id_issued_date),
    idIssuedPlace: d(row.id_issued_place),
    hometown: d(row.hometown),
    ethnicity: d(row.ethnicity),
    nationality: d(row.nationality),
    gender: (row.gender as 'MALE' | 'FEMALE' | 'OTHER' | null) ?? undefined,
    educationLevel: d(row.education_level),
    major: d(row.major),
    almaMater: d(row.alma_mater),
    practiceStartDate: d(row.practice_start_date),
    managementStartDate: d(row.management_start_date),
    publicTitle: d(row.public_title),
    portraitUrl: d(row.portrait_url),
    isPublicProfile: row.is_public_profile ?? false,
    showPublicStats: row.show_public_stats ?? false,
    dossierUpdatedAt: d(row.dossier_updated_at),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function auctioneerToRow(
  a: Auctioneer,
  ids: { organizationId: string; auctionOrgId: string | null },
): OrgAuctioneerInsert {
  return {
    // id để undefined khi thêm mới ⇒ Postgres tự sinh; có id thì upsert đúng dòng.
    id: a.id && a.id.length >= 32 ? a.id : undefined,
    organization_id: ids.organizationId,
    auction_org_id: ids.auctionOrgId,

    source: a.source,
    crawled_at: orNull(a.crawledAt),
    crawled_from_url: orNull(a.crawledFromUrl),
    is_verified_by_public_source: a.isVerifiedByPublicSource,

    full_name: a.fullName,
    date_of_birth: orNull(a.dateOfBirth),
    permanent_address: orNull(a.permanentAddress),
    professional_cert_number: a.professionalCertNumber ?? '',
    professional_cert_issued_date: orNull(a.professionalCertIssuedDate),
    license_number: a.licenseNumber,
    license_issued_date: a.licenseIssuedDate,
    joined_date: a.joinedDate,

    field_sources: a.fieldSources ?? makeDefaultFieldSources('USER'),
    overrides: (a.overrides ?? []) as unknown as Json,

    position: a.position,
    contract_type: a.contractType,
    license_expiry_date: orNull(a.licenseExpiryDate),
    email: orNull(a.email),
    phone: orNull(a.phone),
    internal_notes: orNull(a.internalNotes),
    ended_date: orNull(a.endedDate),
    is_active: a.isActive,

    attached_documents: a.attachedDocuments ?? [],

    id_number: orNull(a.idNumber),
    id_type: a.idType ?? null,
    id_issued_date: orNull(a.idIssuedDate),
    id_issued_place: orNull(a.idIssuedPlace),
    hometown: orNull(a.hometown),
    ethnicity: orNull(a.ethnicity),
    nationality: orNull(a.nationality),
    gender: a.gender ?? null,
    education_level: orNull(a.educationLevel),
    major: orNull(a.major),
    alma_mater: orNull(a.almaMater),
    practice_start_date: orNull(a.practiceStartDate),
    management_start_date: orNull(a.managementStartDate),
    public_title: orNull(a.publicTitle),
    portrait_url: orNull(a.portraitUrl),
    is_public_profile: a.isPublicProfile ?? false,
    show_public_stats: a.showPublicStats ?? false,
    dossier_updated_at: orNull(a.dossierUpdatedAt),
  }
}

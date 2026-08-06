// Truy cập org_general_info + org_bank_accounts + org_branches.
// Thay src/lib/general-info/storage.ts (localStorage).

import { supabase } from '@/integrations/supabase/client'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'
import type { BankAccount, Branch, OrgGeneralInfo, OrgType } from '@/types/general-info'

type InfoRow = Tables<'org_general_info'>
type BankRow = Tables<'org_bank_accounts'>
type BranchRow = Tables<'org_branches'>

const u = (v: string | null) => v ?? undefined

function rowToBank(r: BankRow): BankAccount {
  return {
    id: r.id,
    bankName: r.bank_name,
    accountNumber: r.account_number,
    accountHolder: r.account_holder,
    branch: u(r.branch),
    isPrimary: r.is_primary,
  }
}

function rowToBranch(r: BranchRow): Branch {
  return {
    id: r.id,
    name: r.name,
    type: r.type as Branch['type'],
    address: r.address,
    province: r.province,
    district: u(r.district),
    ward: u(r.ward),
    phone: u(r.phone),
    email: u(r.email),
    managerName: u(r.manager_name),
    establishedDate: u(r.established_date),
    isActive: r.is_active,
  }
}

export function rowToGeneralInfo(
  row: InfoRow,
  banks: BankRow[],
  branches: BranchRow[],
): OrgGeneralInfo {
  return {
    id: row.id,
    name: row.name,
    shortName: u(row.short_name),
    // org_type nullable ở DB (tổ chức mới chưa chọn) nhưng type UI bắt buộc —
    // mặc định về loại phổ biến nhất thay vì để undefined làm vỡ select.
    orgType: (row.org_type ?? 'CONG_TY_HOP_DANH') as OrgType,
    taxCode: row.tax_code,
    registrationCode: u(row.registration_code),

    logoUrl: u(row.logo_url),
    logoInitials: u(row.logo_initials),
    brandColor: u(row.brand_color),

    address: row.address,
    ward: u(row.ward),
    district: u(row.district),
    province: row.province,

    phone: row.phone,
    alternativePhone: u(row.alternative_phone),
    fax: u(row.fax),
    email: row.email,
    alternativeEmail: u(row.alternative_email),
    website: u(row.website),

    legalRepName: row.legal_rep_name,
    legalRepPosition: u(row.legal_rep_position),
    legalRepIdNumber: u(row.legal_rep_id_number),
    legalRepIdIssuedDate: u(row.legal_rep_id_issued_date),
    legalRepIdIssuedPlace: u(row.legal_rep_id_issued_place),

    foundedDate: row.founded_date ?? '',
    establishmentDecisionNumber: u(row.establishment_decision_number),
    establishmentDecisionDate: u(row.establishment_decision_date),
    establishmentDecisionIssuer: u(row.establishment_decision_issuer),
    establishmentDecisionFile: u(row.establishment_decision_file),

    businessLicenseNumber: u(row.business_license_number),
    businessLicenseDate: u(row.business_license_date),
    businessLicenseIssuer: u(row.business_license_issuer),
    businessLicenseFile: u(row.business_license_file),

    isListedInMOJDirectory: row.is_listed_in_moj_directory,
    mojListingNotes: u(row.moj_listing_notes),

    bankAccounts: banks.map(rowToBank),
    branches: branches.map(rowToBranch),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUpdatedBy: u(row.last_updated_by),
  }
}

function infoToRow(
  info: OrgGeneralInfo,
  organizationId: string,
): TablesInsert<'org_general_info'> {
  // Ngày rỗng '' phải thành NULL: cột DATE không nhận chuỗi rỗng.
  const d = (v?: string) => (v && v.trim() ? v : null)
  return {
    organization_id: organizationId,
    name: info.name,
    short_name: info.shortName ?? null,
    org_type: info.orgType ?? null,
    tax_code: info.taxCode,
    registration_code: info.registrationCode ?? null,
    logo_url: info.logoUrl ?? null,
    logo_initials: info.logoInitials ?? null,
    brand_color: info.brandColor ?? null,
    address: info.address,
    ward: info.ward ?? null,
    district: info.district ?? null,
    province: info.province,
    phone: info.phone,
    alternative_phone: info.alternativePhone ?? null,
    fax: info.fax ?? null,
    email: info.email,
    alternative_email: info.alternativeEmail ?? null,
    website: info.website ?? null,
    legal_rep_name: info.legalRepName,
    legal_rep_position: info.legalRepPosition ?? null,
    legal_rep_id_number: info.legalRepIdNumber ?? null,
    legal_rep_id_issued_date: d(info.legalRepIdIssuedDate),
    legal_rep_id_issued_place: info.legalRepIdIssuedPlace ?? null,
    founded_date: d(info.foundedDate),
    establishment_decision_number: info.establishmentDecisionNumber ?? null,
    establishment_decision_date: d(info.establishmentDecisionDate),
    establishment_decision_issuer: info.establishmentDecisionIssuer ?? null,
    establishment_decision_file: info.establishmentDecisionFile ?? null,
    business_license_number: info.businessLicenseNumber ?? null,
    business_license_date: d(info.businessLicenseDate),
    business_license_issuer: info.businessLicenseIssuer ?? null,
    business_license_file: info.businessLicenseFile ?? null,
    is_listed_in_moj_directory: info.isListedInMOJDirectory,
    moj_listing_notes: info.mojListingNotes ?? null,
  }
}

export async function getGeneralInfo(organizationId: string): Promise<OrgGeneralInfo | null> {
  const [infoRes, banksRes, branchesRes] = await Promise.all([
    supabase.from('org_general_info').select('*').eq('organization_id', organizationId).maybeSingle(),
    supabase.from('org_bank_accounts').select('*').eq('organization_id', organizationId).order('sort_order'),
    supabase.from('org_branches').select('*').eq('organization_id', organizationId).order('created_at'),
  ])
  if (infoRes.error) throw infoRes.error
  if (!infoRes.data) return null
  if (banksRes.error) throw banksRes.error
  if (branchesRes.error) throw branchesRes.error

  return rowToGeneralInfo(
    infoRes.data as InfoRow,
    (banksRes.data ?? []) as BankRow[],
    (branchesRes.data ?? []) as BranchRow[],
  )
}

/** Ghi phần vô hướng. Chi nhánh / tài khoản có hàm riêng bên dưới. */
export async function saveGeneralInfo(
  info: OrgGeneralInfo,
  organizationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('org_general_info')
    // organization_id là UNIQUE nên upsert theo nó, không cần biết id sẵn có.
    .upsert(infoToRow(info, organizationId), { onConflict: 'organization_id' })
  if (error) throw error
}

// ─── Tài khoản ngân hàng ─────────────────────────────────────────────────────

/**
 * Đặt một tài khoản làm chính. Phải BỎ cờ ở các tài khoản khác trước, vì DB có
 * partial unique index chỉ cho phép một is_primary mỗi tổ chức — ghi trực tiếp
 * sẽ vi phạm ràng buộc.
 */
async function clearPrimary(organizationId: string, exceptId?: string): Promise<void> {
  let q = supabase
    .from('org_bank_accounts')
    .update({ is_primary: false })
    .eq('organization_id', organizationId)
    .eq('is_primary', true)
  if (exceptId) q = q.neq('id', exceptId)
  const { error } = await q
  if (error) throw error
}

export async function addBankAccount(
  account: Omit<BankAccount, 'id'>,
  organizationId: string,
): Promise<void> {
  if (account.isPrimary) await clearPrimary(organizationId)
  const { error } = await supabase.from('org_bank_accounts').insert({
    organization_id: organizationId,
    bank_name: account.bankName,
    account_number: account.accountNumber,
    account_holder: account.accountHolder,
    branch: account.branch ?? null,
    is_primary: account.isPrimary,
  })
  if (error) throw error
}

export async function updateBankAccount(
  account: BankAccount,
  organizationId: string,
): Promise<void> {
  if (account.isPrimary) await clearPrimary(organizationId, account.id)
  const { error } = await supabase
    .from('org_bank_accounts')
    .update({
      bank_name: account.bankName,
      account_number: account.accountNumber,
      account_holder: account.accountHolder,
      branch: account.branch ?? null,
      is_primary: account.isPrimary,
    })
    .eq('id', account.id)
  if (error) throw error
}

export async function removeBankAccount(id: string): Promise<void> {
  const { error } = await supabase.from('org_bank_accounts').delete().eq('id', id)
  if (error) throw error
}

// ─── Chi nhánh ───────────────────────────────────────────────────────────────

const branchFields = (b: Omit<Branch, 'id'>) => ({
  name: b.name,
  type: b.type,
  address: b.address,
  province: b.province,
  district: b.district ?? null,
  ward: b.ward ?? null,
  phone: b.phone ?? null,
  email: b.email ?? null,
  manager_name: b.managerName ?? null,
  established_date: b.establishedDate && b.establishedDate.trim() ? b.establishedDate : null,
  is_active: b.isActive,
})

export async function addBranch(
  branch: Omit<Branch, 'id'>,
  organizationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('org_branches')
    .insert({ organization_id: organizationId, ...branchFields(branch) })
  if (error) throw error
}

export async function updateBranch(branch: Branch): Promise<void> {
  const { error } = await supabase
    .from('org_branches')
    .update(branchFields(branch))
    .eq('id', branch.id)
  if (error) throw error
}

export async function removeBranch(id: string): Promise<void> {
  const { error } = await supabase.from('org_branches').delete().eq('id', id)
  if (error) throw error
}

// Di trú MỘT LẦN dữ liệu Hồ sơ năng lực từ localStorage sang Supabase.
//
// Phủ 5 module: thuế, thông tin chung, cơ sở vật chất, hồ sơ dự tuyển, hồ sơ
// năng lực tổng hợp. (Tủ tài liệu có script riêng ở lib/documents.)
//
// Nguyên tắc giống bản của tủ tài liệu:
//   • KHÔNG xoá localStorage — lỗi giữa đường thì lần sau chạy lại được;
//   • mọi thao tác ghi là upsert theo id nên chạy lại không nhân đôi;
//   • chỉ đóng dấu "đã xong" khi không còn lỗi.
//
// Gói theo dõi nhu cầu KHÔNG di trú: nó gắn với người dùng chứ không phải tổ
// chức, và bản localStorage không lưu userId nên không có cách nào biết gói đó
// của ai. Di trú mù sẽ gán gói của người này cho người khác — thà để họ mất gói
// (có thể tra ledger credit để hoàn) hơn là gán sai.

import type { Application } from '@/types/application'
import type { CapacityProfile } from '@/types/capacity-profile'
import type { Infrastructure } from '@/types/infrastructure'
import type { OrgGeneralInfo } from '@/types/general-info'
import type { TaxRecord } from '@/types/tax'
import * as taxRepo from '@/lib/tax/supabase-repo'
import * as giRepo from '@/lib/general-info/supabase-repo'
import * as infraRepo from '@/lib/infrastructure/supabase-repo'
import * as appRepo from '@/lib/applications/supabase-repo'

const KEYS = {
  tax: 'tsd:tax-records',
  generalInfo: 'tsd:general-info',
  infrastructure: 'tsd:infrastructure',
  applicationList: 'tsd:applications',
  application: (id: string) => `tsd:application:${id}`,
  capacity: 'tsd:capacity:profile',
}
const DONE_KEY = (organizationId: string) => `tsd:capacity-migrated:${organizationId}`

export interface CapacityMigrationResult {
  ran: boolean
  taxRecords: number
  generalInfo: boolean
  infrastructure: boolean
  applications: number
  capacityProfile: boolean
  errors: string[]
}

const EMPTY: CapacityMigrationResult = {
  ran: false,
  taxRecords: 0,
  generalInfo: false,
  infrastructure: false,
  applications: 0,
  capacityProfile: false,
  errors: [],
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function hasLocalCapacityData(): boolean {
  return Object.values({
    tax: readJson<TaxRecord[]>(KEYS.tax)?.length,
    gi: readJson<OrgGeneralInfo>(KEYS.generalInfo) ? 1 : 0,
    infra: readJson<Infrastructure>(KEYS.infrastructure) ? 1 : 0,
    apps: readJson<{ id: string }[]>(KEYS.applicationList)?.length,
    cap: readJson<CapacityProfile>(KEYS.capacity) ? 1 : 0,
  }).some((n) => !!n)
}

export async function migrateCapacityFromLocal(
  organizationId: string,
): Promise<CapacityMigrationResult> {
  if (!organizationId) return EMPTY
  try {
    if (localStorage.getItem(DONE_KEY(organizationId))) return EMPTY
  } catch {
    return EMPTY
  }

  const stamp = () => {
    try {
      localStorage.setItem(DONE_KEY(organizationId), new Date().toISOString())
    } catch {
      /* localStorage bị chặn — bỏ qua */
    }
  }

  if (!hasLocalCapacityData()) {
    stamp()
    return EMPTY
  }

  const r: CapacityMigrationResult = { ...EMPTY, ran: true, errors: [] }
  const fail = (what: string, e: unknown) =>
    r.errors.push(`${what}: ${e instanceof Error ? e.message : 'lỗi'}`)

  // ── Thông tin chung (phải đi TRƯỚC: các mục khác tham chiếu tổ chức) ────────
  const gi = readJson<OrgGeneralInfo>(KEYS.generalInfo)
  if (gi) {
    try {
      await giRepo.saveGeneralInfo(gi, organizationId)
      // Chi nhánh và tài khoản nay là bảng riêng — ghi từng dòng.
      for (const b of gi.branches ?? []) await giRepo.addBranch(b, organizationId)
      for (const a of gi.bankAccounts ?? []) await giRepo.addBankAccount(a, organizationId)
      r.generalInfo = true
    } catch (e) {
      fail('Thông tin chung', e)
    }
  }

  // ── Thuế ───────────────────────────────────────────────────────────────────
  for (const rec of readJson<TaxRecord[]>(KEYS.tax) ?? []) {
    try {
      await taxRepo.upsertTaxRecord(rec, organizationId)
      r.taxRecords++
    } catch (e) {
      fail(`Bản ghi thuế ${rec.year}`, e)
    }
  }

  // ── Cơ sở vật chất ─────────────────────────────────────────────────────────
  const infra = readJson<Infrastructure>(KEYS.infrastructure)
  if (infra) {
    try {
      // orgId cũ hardcode 'default' — ghi đè bằng tổ chức thật.
      await infraRepo.saveInfrastructure({ ...infra, orgId: organizationId }, organizationId)
      r.infrastructure = true
    } catch (e) {
      fail('Cơ sở vật chất', e)
    }
  }

  // ── Hồ sơ dự tuyển ─────────────────────────────────────────────────────────
  for (const { id } of readJson<{ id: string }[]>(KEYS.applicationList) ?? []) {
    const app = readJson<Application>(KEYS.application(id))
    if (!app) continue
    try {
      await appRepo.saveApplication({ ...app, orgId: organizationId }, organizationId)
      r.applications++
    } catch (e) {
      fail(`Hồ sơ "${app.name ?? id}"`, e)
    }
  }

  // ── Hồ sơ năng lực tổng hợp (đi CUỐI: các bước trên đã cập nhật từng mục) ───
  const cap = readJson<CapacityProfile>(KEYS.capacity)
  if (cap) {
    try {
      await appRepo.saveCapacityProfile(cap, organizationId)
      r.capacityProfile = true
    } catch (e) {
      fail('Hồ sơ năng lực', e)
    }
  }

  if (r.errors.length === 0) stamp()
  return r
}

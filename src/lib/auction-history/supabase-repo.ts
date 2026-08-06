// Truy cập bảng org_auction_records cho module Lịch sử đấu giá.
//
// Trước đây module này ghép `listings` (Supabase) với enrichment ở localStorage.
// Cách đó khiến thành tích của tổ chức bị chặn ở đúng số tin đang rao, và phần
// người dùng nhập thì mất khi đổi máy. Nay toàn bộ nằm ở org_auction_records;
// bản ghi nào có tin rao tương ứng thì giữ `listing_id` để không nhân đôi.

import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import type { AuctionRecord, AssetResult, DataSource } from '@/types/auction-record'

type Row = Database['public']['Tables']['org_auction_records']['Row']

/** Trường phụ gom trong cột `details` — chỉ để hiển thị/round-trip. */
interface Details {
  auctionFormat?: AuctionRecord['auctionFormat']
  biddingMethod?: AuctionRecord['biddingMethod']
  bidStep?: number
  bidStepPercentage?: number
  maxRounds?: number
  actualRounds?: number
  depositPercentage?: number
  assetResults?: AssetResult[]
  legalStatus?: string
  assetCategoryConfidence?: number
  importedAt?: string
  importBatchId?: string
  crawledAt?: string
  crawledFromUrl?: string
  tags?: string[]
  isVerifiedByUser?: boolean
  isDisputed?: boolean
}

const n = (v: number | string | null): number | undefined =>
  v === null ? undefined : Number(v)

export function rowToRecord(r: Row, auctioneerName?: string): AuctionRecord {
  const d = (r.details ?? {}) as Details
  return {
    id: r.id,
    orgId: r.organization_id,
    source: r.source as DataSource,
    crawledAt: d.crawledAt,
    crawledFromUrl: d.crawledFromUrl,
    importedAt: d.importedAt,
    importBatchId: d.importBatchId,

    auctionDate: r.auction_date,
    auctionNumber: r.auction_number ?? undefined,
    assetDescription: r.asset_description,
    assetCategory: r.asset_category as AuctionRecord['assetCategory'],
    assetCategoryConfidence: d.assetCategoryConfidence,
    assetLocation: r.asset_location ?? undefined,
    legalStatus: d.legalStatus,

    ownerName: r.owner_name ?? '',
    contractNumber: r.contract_number ?? undefined,
    contractSignedDate: r.contract_signed_date ?? undefined,

    startingPrice: n(r.starting_price) ?? 0,
    winningPrice: n(r.winning_price),
    isSuccessful: r.is_successful ?? undefined,
    failureReason: r.failure_reason ?? undefined,
    assetResults: d.assetResults,

    auctionFormat: d.auctionFormat,
    biddingMethod: d.biddingMethod,
    bidStep: d.bidStep,
    bidStepPercentage: d.bidStepPercentage,
    maxRounds: d.maxRounds,
    actualRounds: d.actualRounds,
    numberOfParticipants: r.number_of_participants ?? undefined,
    numberOfBids: r.number_of_bids ?? undefined,
    depositPercentage: d.depositPercentage,

    // Người điều hành: DB lưu FK, phía UI vẫn dùng tên như trước.
    auctioneer: auctioneerName,
    internalNotes: r.internal_notes ?? undefined,
    attachedDocuments: [],
    tags: d.tags,

    fieldSources: {},
    overrides: [],
    isVerifiedByUser: d.isVerifiedByUser ?? false,
    isDisputed: d.isDisputed ?? false,

    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export interface WriteContext {
  organizationId: string
  auctionOrgId: string | null
  /** Tên → id để quy chiếu người điều hành về FK. */
  auctioneerIdByName: Map<string, string>
}

function recordToRow(a: AuctionRecord, ctx: WriteContext) {
  const details: Details = {
    auctionFormat: a.auctionFormat,
    biddingMethod: a.biddingMethod,
    bidStep: a.bidStep,
    bidStepPercentage: a.bidStepPercentage,
    maxRounds: a.maxRounds,
    actualRounds: a.actualRounds,
    depositPercentage: a.depositPercentage,
    assetResults: a.assetResults,
    legalStatus: a.legalStatus,
    assetCategoryConfidence: a.assetCategoryConfidence,
    importedAt: a.importedAt,
    importBatchId: a.importBatchId,
    crawledAt: a.crawledAt,
    crawledFromUrl: a.crawledFromUrl,
    tags: a.tags,
    isVerifiedByUser: a.isVerifiedByUser,
    isDisputed: a.isDisputed,
  }

  return {
    id: a.id && a.id.length >= 32 ? a.id : undefined,
    organization_id: ctx.organizationId,
    auction_org_id: ctx.auctionOrgId,
    auctioneer_id: a.auctioneer ? ctx.auctioneerIdByName.get(a.auctioneer.trim()) ?? null : null,
    source: a.source ?? 'MANUAL',
    auction_date: a.auctionDate,
    auction_number: a.auctionNumber || null,
    asset_description: a.assetDescription,
    asset_category: a.assetCategory ?? 'OTHER',
    asset_location: a.assetLocation || null,
    owner_name: a.ownerName || null,
    contract_number: a.contractNumber || null,
    contract_signed_date: a.contractSignedDate || null,
    starting_price: a.startingPrice ?? null,
    winning_price: a.winningPrice ?? null,
    is_successful: a.isSuccessful ?? null,
    failure_reason: a.failureReason || null,
    number_of_participants: a.numberOfParticipants ?? null,
    number_of_bids: a.numberOfBids ?? null,
    internal_notes: a.internalNotes || null,
    details: JSON.parse(JSON.stringify(details)),
  }
}

export async function listByOrg(organizationId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from('org_auction_records')
    .select('*')
    .eq('organization_id', organizationId)
    .order('auction_date', { ascending: false })
  if (error) throw error
  return data as Row[]
}

export async function upsertRecord(a: AuctionRecord, ctx: WriteContext): Promise<void> {
  const { error } = await supabase.from('org_auction_records').upsert(recordToRow(a, ctx))
  if (error) throw error
}

export async function upsertMany(list: AuctionRecord[], ctx: WriteContext): Promise<void> {
  if (list.length === 0) return
  const { error } = await supabase
    .from('org_auction_records')
    .upsert(list.map((a) => recordToRow(a, ctx)))
  if (error) throw error
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from('org_auction_records').delete().eq('id', id)
  if (error) throw error
}

/** custom_attributes của tin rao gốc — chỉ có với bản ghi sinh từ listing. */
export async function fetchLinkedListings(
  rows: Row[],
): Promise<Record<string, Record<string, unknown>>> {
  const ids = rows.map((r) => r.listing_id).filter(Boolean) as string[]
  if (ids.length === 0) return {}
  const { data } = await supabase
    .from('listings')
    .select('id, title, description, price, status, area, legal_status, custom_attributes, created_at, updated_at')
    .in('id', ids)
  const byListing = new Map((data ?? []).map((l) => [l.id as string, l as Record<string, unknown>]))
  const out: Record<string, Record<string, unknown>> = {}
  for (const r of rows) {
    const l = r.listing_id ? byListing.get(r.listing_id) : undefined
    if (l) out[r.id] = l
  }
  return out
}

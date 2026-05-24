import type { Auctioneer, ConflictRecord } from '@/types/auctioneer'
import { PUBLIC_FIELD_KEYS, makeDefaultFieldSources } from '@/types/auctioneer'

export interface CrawledAuctioneer {
  fullName: string
  dateOfBirth?: string
  permanentAddress?: string
  professionalCertNumber: string
  professionalCertIssuedDate?: string
  licenseNumber: string
  licenseIssuedDate: string
  joinedDate: string
  crawledFromUrl: string
}

export function createFromCrawled(
  crawled: CrawledAuctioneer,
  orgId: string,
  crawledAt: string,
): Auctioneer {
  return {
    id: crypto.randomUUID(),
    orgId,
    source: 'CRAWLED',
    crawledAt,
    crawledFromUrl: crawled.crawledFromUrl,
    isVerifiedByPublicSource: true,
    fullName: crawled.fullName,
    dateOfBirth: crawled.dateOfBirth,
    permanentAddress: crawled.permanentAddress,
    professionalCertNumber: crawled.professionalCertNumber,
    professionalCertIssuedDate: crawled.professionalCertIssuedDate,
    licenseNumber: crawled.licenseNumber,
    licenseIssuedDate: crawled.licenseIssuedDate,
    joinedDate: crawled.joinedDate,
    fieldSources: makeDefaultFieldSources('PUBLIC'),
    overrides: [],
    position: 'AUCTIONEER',
    contractType: 'OFFICIAL',
    isActive: true,
    attachedDocuments: [],
    createdAt: crawledAt,
    updatedAt: crawledAt,
  }
}

export function mergeWithExisting(
  crawled: CrawledAuctioneer,
  existing: Auctioneer,
  crawledAt: string,
): { merged: Auctioneer; conflicts: Omit<ConflictRecord, 'auctioneerId' | 'detectedAt'>[] } {
  const conflicts: Omit<ConflictRecord, 'auctioneerId' | 'detectedAt'>[] = []
  const merged: Auctioneer = { ...existing, crawledAt, crawledFromUrl: crawled.crawledFromUrl }

  for (const field of PUBLIC_FIELD_KEYS) {
    const crawledValue = crawled[field as keyof CrawledAuctioneer] as string | undefined
    if (!crawledValue) continue

    const fieldSrc = existing.fieldSources[field]
    const existingOverride = existing.overrides.find((o) => o.field === field)

    if (fieldSrc === 'USER_OVERRIDE' && existingOverride) {
      // User has overridden — detect conflict if crawl changed from the original
      if (existingOverride.originalValue !== crawledValue) {
        conflicts.push({
          field,
          currentValue: existingOverride.overriddenValue,
          newValueFromCrawl: crawledValue,
        })
      }
      continue
    }

    const currentValue = existing[field as keyof Auctioneer] as string | undefined
    if (currentValue && currentValue !== crawledValue) {
      conflicts.push({ field, currentValue, newValueFromCrawl: crawledValue })
    } else if (!currentValue || currentValue !== crawledValue) {
      ;(merged as Record<string, unknown>)[field] = crawledValue
    }
  }

  return { merged, conflicts }
}

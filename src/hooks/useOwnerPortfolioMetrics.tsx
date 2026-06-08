import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionStatus } from "@/hooks/useAuctionListings";
import { formatPrice } from "@/utils/formatters";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import type { ClaimStatus } from "@/types/asset-owner";

// Flat slug → display name map (parent + children)
const SLUG_NAME_MAP: Record<string, string> = {};
for (const cat of ASSET_CATEGORIES) {
  SLUG_NAME_MAP[cat.slug] = cat.name;
  for (const child of cat.children) {
    SLUG_NAME_MAP[child.slug] = child.name;
  }
}

function slugToName(slug: string): string {
  return SLUG_NAME_MAP[slug] ?? slug;
}

type DistGroup = { label: string; count: number; pct: number };

function groupByLabel<T>(rows: T[], key: (r: T) => string): DistGroup[] {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) => ({ label, count, pct: total ? Math.round((count / total) * 100) : 0 }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortfolioFilter {
  propertyTypeSlugs?: string[];
  provinces?: string[];
  auctionOrgIds?: string[];
  statusLabels?: string[];
  legalStatuses?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface ListingRow {
  id: string;
  title: string;
  price: number;
  priceUnit: string;
  listingStatus: string;
  sessionStatus: string;
  propertyTypeSlug: string;
  province: string;
  auctionOrgId: string | null;
  auctionOrgName: string | null;
  winPrice: number | null;
  auctionTime: string | null;
  registrationDeadline: string | null;
  imageUrl: string | null;
  roundCount: number;
  priceHistory: { date: string; price: number }[];
  legalStatus: string | null;
  matchedName: string | null;
  claimStatus: ClaimStatus;
  confidenceScore: number | null;
}

export interface StatusGroup {
  label: string;
  value: number;
  color: string;
}

export interface PortfolioMetrics {
  totalAssets: number;
  totalStartingPrice: number;
  totalStartingPriceLabel: string;
  statusDistribution: StatusGroup[];
  pendingCount: number;
  successRate: number;
  avgRounds: number;
  pendingAssets: ListingRow[];
  priceByMonth: { month: string; avgPrice: number }[];
  byOrg: { name: string; count: number; pct: number }[];
  byPropertyType: DistGroup[];
  byLegalStatus: DistGroup[];
  byProvince: DistGroup[];
  byBranch: DistGroup[];
  upcomingSessions: ListingRow[];
  allListings: ListingRow[];
  pendingConfirmations: ListingRow[];
  // filter dimension options (for filter screen)
  availablePropertyTypes: string[];
  availableProvinces: string[];
  availableOrgIds: { id: string; name: string }[];
  availableLegalStatuses: string[];
}

const STATUS_COLORS: Record<string, string> = {
  "Chờ đấu":    "hsl(210 90% 56%)",
  "Đang đấu":   "hsl(38 92% 50%)",
  "Đã thành":   "hsl(142 76% 36%)",
  "Không thành":"hsl(0 72% 51%)",
  "Tồn đọng":   "hsl(25 95% 53%)",
};

function classifyListing(row: ListingRow): string {
  if (row.listingStatus === "SOLD_RENTED" || !!row.winPrice) return "Đã thành";
  const ss = row.sessionStatus;
  if (ss === "registration_open" || ss === "upcoming") return "Chờ đấu";
  if (ss === "ongoing") return "Đang đấu";
  // ended
  if (row.roundCount >= 2) return "Tồn đọng";
  return "Không thành";
}

function groupByMonth(entries: { date: string; price: number }[]): { month: string; avgPrice: number }[] {
  const byMonth: Record<string, number[]> = {};
  for (const e of entries) {
    const key = e.date.slice(0, 7); // YYYY-MM
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(e.price);
  }
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, prices]) => ({
      month,
      avgPrice: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
    }));
}

interface RawListing {
  id: string;
  title: string;
  price: number;
  price_unit: string;
  status: string;
  property_type_slug: string;
  address: Record<string, string> | null;
  auction_org_id: string | null;
  custom_attributes: Record<string, unknown> | null;
  image_url: string | null;
  legal_status: string | null;
  auction_organizations: { id: string; name: string } | { id: string; name: string }[] | null;
}

interface RawClaim {
  id: string;
  listing_id: string;
  matched_name: string | null;
  status: ClaimStatus;
  confidence_score: number | null;
  listing: RawListing | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOwnerPortfolioMetrics(
  workspaceId: string | null | undefined,
  filter: PortfolioFilter = {},
) {
  // Q1: claims + listings (all, unfiltered — filter applied client-side)
  const { data: rawClaims, isLoading: claimsLoading } = useQuery({
    queryKey: ["owner-portfolio-claims", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select(`
          id,
          listing_id,
          matched_name,
          status,
          confidence_score,
          listing:listings(
            id, title, price, price_unit, status, property_type_slug,
            address, auction_org_id, custom_attributes, image_url, legal_status,
            auction_organizations(id, name)
          )
        `)
        .eq("workspace_id", workspaceId!)
        .in("status", ["auto_claimed", "pending_confirmation", "confirmed"]);
      if (error) throw error;
      return (data ?? []) as RawClaim[];
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60_000,
  });

  // Q2: price sessions for all claimed listings
  const listingIds = useMemo(
    () => (rawClaims ?? []).map((c) => c.listing?.id).filter((id): id is string => !!id),
    [rawClaims],
  );

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["owner-portfolio-sessions", workspaceId],
    queryFn: async () => {
      if (!listingIds.length) return [];
      const { data, error } = await supabase
        .from("listing_price_sessions")
        .select("listing_id, session_date, price")
        .in("listing_id", listingIds)
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspaceId && listingIds.length > 0,
    staleTime: 2 * 60_000,
  });

  // Build ListingRow array (with round count)
  const allRows: ListingRow[] = useMemo(() => {
    if (!rawClaims) return [];
    const sessionsByListing: Record<string, { date: string; price: number }[]> = {};
    for (const s of sessions ?? []) {
      if (!sessionsByListing[s.listing_id]) sessionsByListing[s.listing_id] = [];
      sessionsByListing[s.listing_id].push({ date: s.session_date, price: Number(s.price) });
    }

    return (rawClaims ?? []).flatMap((claim: RawClaim) => {
      const l = claim.listing;
      if (!l) return [];
      const ca = (l.custom_attributes ?? {}) as Record<string, unknown>;
      const address = (l.address ?? {}) as Record<string, string>;
      const org = Array.isArray(l.auction_organizations)
        ? l.auction_organizations[0]
        : l.auction_organizations;
      const history = sessionsByListing[l.id] ?? [];

      const pseudoListing = {
        id: l.id,
        title: l.title,
        status: l.status,
        custom_attributes: ca,
        auction_org_id: l.auction_org_id,
        asset_owner_id: null,
        description: null,
        price: l.price,
        property_type_slug: l.property_type_slug,
        address: l.address,
        image_url: l.image_url,
        area: 0,
        created_at: "",
        views_count: null,
      };

      return [{
        id: l.id,
        title: l.title,
        price: Number(l.price),
        priceUnit: l.price_unit ?? "TOTAL",
        listingStatus: l.status,
        sessionStatus: getSessionStatus(pseudoListing),
        propertyTypeSlug: l.property_type_slug ?? "",
        province: address.province ?? address.city ?? "",
        auctionOrgId: l.auction_org_id ?? null,
        auctionOrgName: org?.name ?? ca.org_name ?? null,
        winPrice: ca.win_price ?? ca.winning_price ?? null,
        auctionTime: ca.auction_time ?? ca.auction_date ?? null,
        registrationDeadline: ca.registration_deadline ?? ca.document_sale_end ?? null,
        imageUrl: l.image_url ?? null,
        roundCount: history.length,
        priceHistory: history,
        legalStatus: l.legal_status ?? null,
        matchedName: claim.matched_name ?? null,
        claimStatus: claim.status,
        confidenceScore: claim.confidence_score ?? null,
      } as ListingRow];
    });
  }, [rawClaims, sessions]);

  // Apply filter client-side
  const filtered: ListingRow[] = useMemo(() => {
    let rows = allRows;
    if (filter.propertyTypeSlugs?.length)
      rows = rows.filter((r) => filter.propertyTypeSlugs!.includes(r.propertyTypeSlug));
    if (filter.provinces?.length)
      rows = rows.filter((r) => filter.provinces!.includes(r.province));
    if (filter.auctionOrgIds?.length)
      rows = rows.filter((r) => r.auctionOrgId && filter.auctionOrgIds!.includes(r.auctionOrgId));
    if (filter.statusLabels?.length)
      rows = rows.filter((r) => filter.statusLabels!.includes(classifyListing(r)));
    if (filter.legalStatuses?.length)
      rows = rows.filter((r) => r.legalStatus && filter.legalStatuses!.includes(r.legalStatus));
    if (filter.dateFrom)
      rows = rows.filter((r) => !r.auctionTime || r.auctionTime >= filter.dateFrom!);
    if (filter.dateTo)
      rows = rows.filter((r) => !r.auctionTime || r.auctionTime <= filter.dateTo! + "T23:59:59");
    return rows;
  }, [allRows, filter]);

  // Compute metrics from filtered rows
  const metrics: PortfolioMetrics = useMemo(() => {
    const total = filtered.length;
    const successCount = filtered.filter((r) => classifyListing(r) === "Đã thành").length;
    const pendingAssets = filtered.filter((r) => classifyListing(r) === "Tồn đọng");
    const totalPrice = filtered.reduce((s, r) => s + r.price, 0);

    // Status distribution
    const statusCounts: Record<string, number> = {
      "Chờ đấu": 0, "Đang đấu": 0, "Đã thành": 0, "Không thành": 0, "Tồn đọng": 0,
    };
    for (const r of filtered) {
      const label = classifyListing(r);
      statusCounts[label] = (statusCounts[label] ?? 0) + 1;
    }
    const statusDistribution = Object.entries(statusCounts)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] ?? "#888" }));

    // Avg rounds (only for listings that have at least 1 session)
    const withRounds = filtered.filter((r) => r.roundCount > 0);
    const avgRounds = withRounds.length
      ? Math.round((withRounds.reduce((s, r) => s + r.roundCount, 0) / withRounds.length) * 10) / 10
      : 0;

    // Price by month (from price sessions of filtered listings)
    const allHistory = filtered.flatMap((r) => r.priceHistory);
    const priceByMonth = groupByMonth(allHistory);

    // By org
    const orgCounts: Record<string, { name: string; count: number }> = {};
    for (const r of filtered) {
      const key = r.auctionOrgId ?? "__unknown";
      if (!orgCounts[key]) orgCounts[key] = { name: r.auctionOrgName ?? "Chưa xác định", count: 0 };
      orgCounts[key].count++;
    }
    const byOrg = Object.values(orgCounts)
      .sort((a, b) => b.count - a.count)
      .map((o) => ({ ...o, pct: total ? Math.round((o.count / total) * 100) : 0 }));

    // Distribution groupings
    const byPropertyType = groupByLabel(filtered, (r) => slugToName(r.propertyTypeSlug));
    const byLegalStatus  = groupByLabel(filtered, (r) => r.legalStatus ?? "Không xác định");
    const byProvince     = groupByLabel(filtered, (r) => r.province || "Không xác định");
    const byBranch       = groupByLabel(filtered, (r) => r.matchedName || "Không phân loại");

    // Pending confirmations (low-confidence claims needing owner review)
    const pendingConfirmations = filtered
      .filter((r) => r.claimStatus === "pending_confirmation")
      .sort((a, b) => (a.confidenceScore ?? 0) - (b.confidenceScore ?? 0))
      .slice(0, 5);

    // Upcoming sessions
    const now = new Date().toISOString();
    const upcomingSessions = filtered
      .filter((r) => r.auctionTime && r.auctionTime > now)
      .sort((a, b) => (a.auctionTime ?? "").localeCompare(b.auctionTime ?? ""))
      .slice(0, 10);

    // Filter dimension options (from allRows, not filtered)
    const availablePropertyTypes = [...new Set(allRows.map((r) => r.propertyTypeSlug).filter(Boolean))];
    const availableProvinces = [...new Set(allRows.map((r) => r.province).filter(Boolean))];
    const availableLegalStatuses = [...new Set(allRows.map((r) => r.legalStatus).filter((s): s is string => !!s))];
    const orgMap = new Map<string, string>();
    for (const r of allRows) {
      if (r.auctionOrgId && r.auctionOrgName) orgMap.set(r.auctionOrgId, r.auctionOrgName);
    }
    const availableOrgIds = [...orgMap.entries()].map(([id, name]) => ({ id, name }));

    return {
      totalAssets: total,
      totalStartingPrice: totalPrice,
      totalStartingPriceLabel: formatPrice(totalPrice, "TOTAL"),
      statusDistribution,
      pendingCount: pendingAssets.length,
      successRate: total ? Math.round((successCount / total) * 100) : 0,
      avgRounds,
      pendingAssets,
      priceByMonth,
      byOrg,
      byPropertyType,
      byLegalStatus,
      byProvince,
      byBranch,
      upcomingSessions,
      pendingConfirmations,
      allListings: filtered,
      availablePropertyTypes,
      availableProvinces,
      availableOrgIds,
      availableLegalStatuses,
    };
  }, [filtered, allRows]);

  return {
    metrics,
    isLoading: claimsLoading || (listingIds.length > 0 && sessionsLoading),
  };
}

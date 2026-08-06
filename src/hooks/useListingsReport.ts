// Dữ liệu cho trang báo cáo "Tin đấu giá" (Admin).
//
// Bộ lọc là CẤP TRANG: cùng một bộ `ListingsTableFilters` chạy qua cả phần tổng
// hợp lẫn bảng chi tiết, và cả hai RPC đều join vào public.admin_listings_scope()
// — một định nghĩa bộ lọc duy nhất, biểu đồ không thể lệch với bảng.
//
// Hai query tách rời có chủ đích: bảng đổi trang liên tục, không nên kéo theo
// việc chạy lại 10 section tổng hợp.

import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  formatListingsReport,
  PARENT_LABELS,
  type RawListingsReport,
} from "@/lib/reports/listingsReport";
import type { AuctionSessionStatus } from "@/lib/listings/sessionStatus";
import type { Granularity } from "@/lib/reports/transactionReport";

// ─── Bộ lọc ──────────────────────────────────────────────────────────────────

/** Thực thể được chọn trong bộ lọc — giữ luôn tên để nút hiển thị mà không phải tra lại. */
export interface EntityRef {
  id: string;
  name: string;
}

export interface ListingsTableFilters {
  status: string; // "all" | listing_status
  parent: string; // "all" | slug nhóm cha
  province: string; // "all" | tên tỉnh
  org: EntityRef | null; // tổ chức đấu giá
  owner: EntityRef | null; // chủ tài sản
  q: string;
  page: number; // 0-based, chỉ dùng cho bảng chi tiết
}

export const DEFAULT_LISTINGS_FILTERS: ListingsTableFilters = {
  status: "all",
  parent: "all",
  province: "all",
  org: null,
  owner: null,
  q: "",
  page: 0,
};

export const hasActiveFilters = (f: ListingsTableFilters) =>
  f.status !== "all" ||
  f.parent !== "all" ||
  f.province !== "all" ||
  f.org !== null ||
  f.owner !== null ||
  f.q.trim() !== "";

/** "all" / rỗng → null, đúng quy ước "NULL = không lọc" của admin_listings_scope. */
const nul = (v: string) => (v && v !== "all" ? v : null);

interface ScopeArgs {
  _from: string;
  _to: string;
  _status: string | null;
  _parent: string | null;
  _province: string | null;
  _org_id: string | null;
  _owner_id: string | null;
  _q: string | null;
}

function scopeArgs(
  fromISO: string,
  toISO: string,
  f: ListingsTableFilters,
  q: string,
): ScopeArgs {
  return {
    _from: fromISO,
    _to: toISO,
    _status: nul(f.status),
    _parent: nul(f.parent),
    _province: nul(f.province),
    _org_id: f.org?.id ?? null,
    _owner_id: f.owner?.id ?? null,
    _q: q.trim() || null,
  };
}

/** Phần bộ lọc đi vào queryKey (bỏ `page` — chỉ bảng quan tâm). */
const filterKey = (f: ListingsTableFilters, q: string) => [
  f.status,
  f.parent,
  f.province,
  f.org?.id ?? "all",
  f.owner?.id ?? "all",
  q.trim(),
];

/** Debounce ô tìm kiếm — chỉ giá trị đã lắng mới vào queryKey. */
function useDebounced(value: string, ms = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// ─── A. Tổng hợp qua RPC ─────────────────────────────────────────────────────

export function useListingsReport(
  range: { from: Date; to: Date },
  granularity: Granularity,
  filters: ListingsTableFilters,
) {
  const fromISO = startOfDay(range.from).toISOString();
  const toISO = endOfDay(range.to).toISOString();
  const debouncedQ = useDebounced(filters.q);

  const query = useQuery({
    queryKey: [
      "admin",
      "listings-report",
      fromISO,
      toISO,
      granularity,
      ...filterKey(filters, debouncedQ),
    ],
    queryFn: async (): Promise<RawListingsReport> => {
      const { data, error } = await supabase.rpc("admin_listings_report", {
        ...scopeArgs(fromISO, toISO, filters, debouncedQ),
        _granularity: granularity,
      });
      if (error) throw error;
      return data as unknown as RawListingsReport;
    },
    placeholderData: keepPreviousData,
  });

  const report = useMemo(
    () => formatListingsReport(query.data, range, granularity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, fromISO, toISO, granularity],
  );

  return { ...query, report };
}

// ─── B. Bảng chi tiết ────────────────────────────────────────────────────────

export const LISTINGS_PAGE_SIZE = 20;

export interface AdminListingRow {
  id: string;
  title: string;
  status: string;
  propertyTypeSlug: string;
  categoryLabel: string;
  province: string;
  district: string | null;
  value: number | null;
  area: number;
  orgName: string | null;
  ownerName: string | null;
  sessionStatus: AuctionSessionStatus;
  createdAt: string;
  views: number;
}

interface RawRow {
  id: string;
  title: string;
  status: string;
  slug: string;
  parent_slug: string;
  province: string;
  district: string | null;
  value: number | string | null;
  area: number | string | null;
  org_name: string | null;
  owner_name: string | null;
  session_status: string;
  created_at: string;
  views: number | string | null;
}

export function useAdminListingsTable(
  range: { from: Date; to: Date },
  filters: ListingsTableFilters,
) {
  const fromISO = startOfDay(range.from).toISOString();
  const toISO = endOfDay(range.to).toISOString();
  const debouncedQ = useDebounced(filters.q);
  const { page } = filters;

  const query = useQuery({
    queryKey: [
      "admin",
      "listings-table",
      fromISO,
      toISO,
      ...filterKey(filters, debouncedQ),
      page,
    ],
    queryFn: async (): Promise<{ rows: RawRow[]; total: number }> => {
      const { data, error } = await supabase.rpc("admin_listings_rows", {
        ...scopeArgs(fromISO, toISO, filters, debouncedQ),
        _limit: LISTINGS_PAGE_SIZE,
        _offset: page * LISTINGS_PAGE_SIZE,
      });
      if (error) throw error;
      const d = data as unknown as { rows: RawRow[]; total: number | string };
      return { rows: d?.rows ?? [], total: Number(d?.total ?? 0) };
    },
    placeholderData: keepPreviousData,
  });

  const rows: AdminListingRow[] = useMemo(
    () =>
      (query.data?.rows ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        propertyTypeSlug: r.slug,
        categoryLabel: PARENT_LABELS[r.parent_slug] ?? r.parent_slug,
        province: r.province,
        district: r.district,
        value: r.value === null ? null : Number(r.value),
        area: Number(r.area ?? 0),
        orgName: r.org_name,
        ownerName: r.owner_name,
        sessionStatus: r.session_status as AuctionSessionStatus,
        createdAt: r.created_at,
        views: Number(r.views ?? 0),
      })),
    [query.data],
  );

  const total = query.data?.total ?? 0;

  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / LISTINGS_PAGE_SIZE)),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}

// ─── C. Tra cứu thực thể cho dropdown bộ lọc ─────────────────────────────────

/**
 * Nạp danh sách tổ chức đấu giá / chủ tài sản cho combobox, LỌC PHÍA SERVER.
 * `asset_owners` phình theo số claim nên không kéo hết về rồi lọc ở client;
 * gõ tới đâu query tới đó, cắt 50 dòng.
 */
export function useEntityOptions(
  table: "auction_organizations" | "asset_owners",
  search: string,
  enabled: boolean,
) {
  const debounced = useDebounced(search, 300);

  const query = useQuery({
    queryKey: ["admin", "listing-entity-options", table, debounced],
    queryFn: async (): Promise<EntityRef[]> => {
      let q = supabase.from(table).select("id,name").order("name").limit(50);
      const needle = debounced.trim();
      if (needle) q = q.ilike("name", `%${needle}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, name: r.name ?? "—" }));
    },
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  return { options: query.data ?? [], isFetching: query.isFetching };
}

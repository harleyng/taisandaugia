// Catalog dịch vụ cho UI (trang mua credit). Đọc service_variants + nhóm qua
// public-read RLS, React Query cache 5'. Cung cấp helper chọn gói theo đối tượng
// + tra giá/credit theo variant_key.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceVariant, ServiceAudience } from "@/types/orders";
import { qk } from "@/lib/queryKeys";

export interface CatalogVariantRow extends ServiceVariant {
  group: {
    id: string;
    name: string;
    kind: string;
    category: string | null;
    audience: ServiceAudience;
  } | null;
}

async function fetchCatalog(): Promise<CatalogVariantRow[]> {
  const { data, error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("service_variants")
    .select("*, group:services!inner(id,name,kind,category,audience,is_active)")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CatalogVariantRow[];
}

export function useServiceCatalog() {
  const query = useQuery({
    queryKey: qk.serviceCatalog,
    queryFn: fetchCatalog,
    staleTime: 5 * 60 * 1000,
  });

  const helpers = useMemo(() => {
    const rows = query.data ?? [];
    const byVariantKey = new Map(rows.map((r) => [r.variant_key, r]));
    return {
      rows,
      byVariantKey,
      /** Các gói nạp (category='package') của một đối tượng, theo sort_order. */
      packagesForAudience: (aud: ServiceAudience) =>
        rows
          .filter((r) => r.group?.category === "package" && r.group?.audience === aud)
          .sort((a, b) => a.sort_order - b.sort_order),
      variant: (key: string) => byVariantKey.get(key),
      costOf: (key: string) => byVariantKey.get(key)?.credit_cost ?? 0,
      priceOf: (key: string) => byVariantKey.get(key)?.price ?? 0,
    };
  }, [query.data]);

  return { ...query, ...helpers };
}

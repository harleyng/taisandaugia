// Gọi RPC admin_cpd_report (gộp phía server, ADMIN-guarded) rồi kết luận tuân
// thủ phía client bằng engine dùng chung với portal — xem src/lib/reports/cpdReport.ts.

import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCpdReport, type RawCpdReport } from "@/lib/reports/cpdReport";

export interface CpdReportFilters {
  province: string | null;
  orgId: string | null;
  q: string;
}

export interface CpdFilterOptions {
  provinces: string[];
  organizations: Array<{ id: string; name: string }>;
}

/** "all" / chuỗi rỗng từ UI → NULL cho RPC (NULL = không lọc). */
const nul = (v: string | null): string | null =>
  !v || v === "all" || v.trim() === "" ? null : v;

/** Debounce ô tìm kiếm — chỉ giá trị đã lắng mới vào queryKey. */
function useDebounced(value: string, ms = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function useCpdReport(year: number, filters: CpdReportFilters) {
  const province = nul(filters.province);
  const orgId = nul(filters.orgId);
  const q = nul(useDebounced(filters.q));

  const query = useQuery({
    queryKey: ["admin", "cpd-report", year, province, orgId, q],
    queryFn: async (): Promise<RawCpdReport> => {
      const { data, error } = await supabase.rpc("admin_cpd_report", {
        _year: year,
        _province: province,
        _org_id: orgId,
        _q: q,
      });
      if (error) throw error;
      return data as unknown as RawCpdReport;
    },
    placeholderData: keepPreviousData,
  });

  const report = useMemo(() => formatCpdReport(query.data, year), [query.data, year]);

  return { ...query, report };
}

/** Tuỳ chọn bộ lọc lấy riêng: suy từ `rows` sẽ mất các giá trị đã bị lọc ra. */
export function useCpdFilterOptions() {
  return useQuery({
    queryKey: ["admin", "cpd-report", "filters"],
    queryFn: async (): Promise<CpdFilterOptions> => {
      const { data, error } = await supabase.rpc("admin_cpd_report_filters");
      if (error) throw error;
      return data as unknown as CpdFilterOptions;
    },
    staleTime: 5 * 60_000,
  });
}

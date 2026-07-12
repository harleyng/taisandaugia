// Gọi RPC admin_access_report (tổng hợp phía server, ADMIN-guarded) rồi định dạng
// cho UI. Khác useTransactionReport: granularity NẰM trong queryKey vì server tự
// bucket (không re-bucket ở client) — đổi granularity sẽ refetch.

import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  formatAccessReport,
  type RawAccessReport,
} from "@/lib/reports/accessAnalytics";
import type { Granularity } from "@/lib/reports/transactionReport";

export function useAccessAnalytics(range: { from: Date; to: Date }, granularity: Granularity) {
  const fromISO = startOfDay(range.from).toISOString();
  const toISO = endOfDay(range.to).toISOString();

  const query = useQuery({
    queryKey: ["admin", "access-analytics", fromISO, toISO, granularity],
    queryFn: async (): Promise<RawAccessReport> => {
      const { data, error } = await supabase.rpc("admin_access_report", {
        _from: fromISO,
        _to: toISO,
        _granularity: granularity,
      });
      if (error) throw error;
      return data as unknown as RawAccessReport;
    },
    placeholderData: keepPreviousData,
  });

  const report = useMemo(
    () => formatAccessReport(query.data, range, granularity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, fromISO, toISO, granularity],
  );

  return { ...query, report };
}

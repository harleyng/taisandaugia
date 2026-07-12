// Đọc ledger giao dịch cho một khoảng thời gian rồi tổng hợp phía client.
//
// queryKey chỉ theo range → đổi granularity (ngày/tuần/tháng) KHÔNG refetch, chỉ
// re-bucket qua useMemo. VND lấy từ CREDIT_PACKAGES (trong aggregate), không phải DB.

import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  aggregateTransactionReport,
  type RawTxRow,
  type Granularity,
} from "@/lib/reports/transactionReport";

const SELECT =
  "id, user_id, type, description, credit_delta, created_at, variant_key, profiles(name, email), variant:service_variants(price, name, variant_key, group:services(name, audience))";
const PAGE = 1000;
const MAX_ROWS = 50_000;

async function fetchAllTx(fromISO: string, toISO: string): Promise<RawTxRow[]> {
  const all: RawTxRow[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select(SELECT)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as RawTxRow[];
    all.push(...rows);
    if (rows.length < PAGE || all.length >= MAX_ROWS) {
      if (all.length >= MAX_ROWS && rows.length === PAGE) {
        console.warn(
          `[useTransactionReport] Chạm trần ${MAX_ROWS} dòng — số liệu có thể bị cắt. Cân nhắc RPC tổng hợp phía server.`,
        );
      }
      break;
    }
  }
  return all;
}

export function useTransactionReport(range: { from: Date; to: Date }, granularity: Granularity) {
  const fromISO = startOfDay(range.from).toISOString();
  const toISO = endOfDay(range.to).toISOString();

  const query = useQuery({
    queryKey: ["admin", "transaction-report", fromISO, toISO],
    queryFn: () => fetchAllTx(fromISO, toISO),
    placeholderData: keepPreviousData,
  });

  const report = useMemo(
    () => aggregateTransactionReport(query.data ?? [], range, granularity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, fromISO, toISO, granularity],
  );

  return { ...query, report };
}

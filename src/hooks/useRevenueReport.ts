// Đọc dữ liệu cho báo cáo Doanh thu tổng rồi tổng hợp phía client.
//
// 2 nguồn: (1) credit_transactions dòng nạp (type='purchase', credit_delta>0) —
// lọc server để giảm dữ liệu; (2) orders trong khoảng theo ordered_at. queryKey chỉ
// theo range → đổi granularity KHÔNG refetch, chỉ re-bucket qua useMemo.

import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { type RawTxRow, type Granularity } from "@/lib/reports/transactionReport";
import { aggregateRevenueReport, type OrderRevenueRow } from "@/lib/reports/revenueReport";

const TX_SELECT =
  "id, user_id, type, description, credit_delta, created_at, variant_key, variant:service_variants(price, name, variant_key, group:services(name, audience))";
const ORDER_SELECT = "id, amount, ordered_at, fulfillment_status, service:services(id,name)";
const PAGE = 1000;
const MAX_ROWS = 50_000;

async function fetchPurchases(fromISO: string, toISO: string): Promise<RawTxRow[]> {
  const all: RawTxRow[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select(TX_SELECT)
      .eq("type", "purchase")
      .gt("credit_delta", 0)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as RawTxRow[];
    all.push(...rows);
    if (rows.length < PAGE || all.length >= MAX_ROWS) break;
  }
  return all;
}

async function fetchOrders(fromISO: string, toISO: string): Promise<OrderRevenueRow[]> {
  const { data, error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("orders")
    .select(ORDER_SELECT)
    .gte("ordered_at", fromISO)
    .lte("ordered_at", toISO)
    .order("ordered_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrderRevenueRow[];
}

export function useRevenueReport(range: { from: Date; to: Date }, granularity: Granularity) {
  const fromISO = startOfDay(range.from).toISOString();
  const toISO = endOfDay(range.to).toISOString();

  const query = useQuery({
    queryKey: ["admin", "revenue-report", fromISO, toISO],
    queryFn: async () => {
      const [txRows, orders] = await Promise.all([
        fetchPurchases(fromISO, toISO),
        fetchOrders(fromISO, toISO),
      ]);
      return { txRows, orders };
    },
    placeholderData: keepPreviousData,
  });

  const report = useMemo(
    () =>
      aggregateRevenueReport(
        query.data?.txRows ?? [],
        query.data?.orders ?? [],
        range,
        granularity,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, fromISO, toISO, granularity],
  );

  return { ...query, report };
}

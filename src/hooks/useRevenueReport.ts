// Đọc dữ liệu cho báo cáo Doanh thu tổng rồi tổng hợp phía client.
//
// MỘT nguồn duy nhất: bảng `orders`. Từ 20260719000003 mỗi giao dịch nạp credit
// sinh đúng một dòng orders, nên không còn đọc credit_transactions ở đây nữa —
// đó chính là thứ từng tạo ra hai đường cộng doanh thu song song.
//
// queryKey chỉ theo range → đổi granularity KHÔNG refetch, chỉ re-bucket qua useMemo.

import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { type Granularity } from "@/lib/reports/transactionReport";
import { aggregateRevenueReport, type OrderRevenueRow } from "@/lib/reports/revenueReport";

const ORDER_SELECT =
  "id, amount, gross_amount, service_kind, ordered_at, fulfillment_status, " +
  "service:services(id,name,audience), variant:service_variants(id,name,variant_key)";
const PAGE = 1000;
const MAX_ROWS = 50_000;

async function fetchOrders(
  fromISO: string,
  toISO: string,
): Promise<{ rows: OrderRevenueRow[]; truncated: boolean }> {
  const all: OrderRevenueRow[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .from("orders")
      .select(ORDER_SELECT)
      .gte("ordered_at", fromISO)
      .lte("ordered_at", toISO)
      .order("ordered_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as OrderRevenueRow[];
    all.push(...rows);
    // Cắt ở MAX_ROWS phải BÁO ra ngoài, không im lặng báo thiếu doanh thu.
    if (rows.length < PAGE) return { rows: all, truncated: false };
    if (all.length >= MAX_ROWS) return { rows: all, truncated: true };
  }
}

export function useRevenueReport(range: { from: Date; to: Date }, granularity: Granularity) {
  const fromISO = startOfDay(range.from).toISOString();
  const toISO = endOfDay(range.to).toISOString();

  const query = useQuery({
    queryKey: ["admin", "revenue-report", fromISO, toISO],
    queryFn: () => fetchOrders(fromISO, toISO),
    placeholderData: keepPreviousData,
  });

  const report = useMemo(
    () => aggregateRevenueReport(query.data?.rows ?? [], range, granularity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, fromISO, toISO, granularity],
  );

  return { ...query, report, truncated: query.data?.truncated ?? false };
}

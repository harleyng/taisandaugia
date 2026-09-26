import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

/**
 * Dòng hoa hồng đối tác trong sổ orders (admin-only RLS) + mã hợp đồng nguồn — dùng chung
 * cho mọi loại yêu cầu dịch vụ. Dòng chỉ tồn tại sau khi hoàn tất/giao, nên trước đó
 * query tắt; khi chi tiết refetch ra commission_order_id mới thì key mới tự tải.
 */
export function useServiceCommissionOrder(commissionOrderId: string | null | undefined) {
  return useQuery({
    queryKey: qk.serviceRequests.commission(commissionOrderId),
    enabled: !!commissionOrderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, code, gross_amount, amount, commission_type, commission_value, supplier_id, fulfilled_at, supplier_contracts(code, contract_no)",
        )
        .eq("id", commissionOrderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

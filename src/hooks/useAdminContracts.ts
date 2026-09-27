import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { toAdminContractRow, type AdminContractRow, type AdminContractRpcRow } from "@/lib/contracts/adminRows";
import type { ConsignmentContract, ContractEvent } from "@/types/consignment-contract";

/**
 * Mọi hợp đồng trên sàn cho admin (module "hop-dong") — RPC chuẩn hoá 3 loại,
 * cổng quyền ở server (quyền đọc bảng đơn dịch vụ đi theo module riêng từng loại).
 */
export function useAdminContracts(enabled = true) {
  return useQuery({
    queryKey: qk.adminContracts,
    enabled,
    queryFn: async (): Promise<AdminContractRow[]> => {
      const { data, error } = await supabase.rpc("admin_contract_list");
      if (error) throw error;
      return ((data ?? []) as unknown as AdminContractRpcRow[]).map(toAdminContractRow);
    },
  });
}

export interface AdminConsignmentContractDetail {
  contract: ConsignmentContract;
  events: ContractEvent[];
}

/** Hợp đồng ký gửi cho admin — đọc thẳng bảng (policy cc_admin_read / cce_admin_read). */
export function useAdminConsignmentContract(id: string | null | undefined) {
  return useQuery({
    queryKey: [...qk.adminContracts, "ky-gui", id] as const,
    enabled: !!id,
    queryFn: async (): Promise<AdminConsignmentContractDetail | null> => {
      const { data, error } = await supabase.from("consignment_contracts").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: events, error: evErr } = await supabase
        .from("consignment_contract_events")
        .select("action, side, created_at, data")
        .eq("contract_id", id!)
        .order("created_at", { ascending: true });
      if (evErr) throw evErr;
      return {
        contract: data as unknown as ConsignmentContract,
        events: (events ?? []) as unknown as ContractEvent[],
      };
    },
  });
}

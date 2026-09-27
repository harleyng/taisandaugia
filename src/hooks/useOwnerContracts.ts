import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerSaleContracts, useOwnerSaleSummary } from "@/hooks/useSaleContracts";
import { useOwnerConsignmentSummary } from "@/hooks/useConsignmentContract";
import { useOwnerServiceContracts } from "@/hooks/useServiceContracts";
import { qk } from "@/lib/queryKeys";
import {
  fromConsignment,
  fromSale,
  fromService,
  isConsignmentContractAction,
  sortContractRows,
  type ContractListRow,
  type OwnerConsignmentContractItem,
} from "@/lib/contracts/rows";
import type { ConsignmentContract } from "@/types/consignment-contract";
import type { RequestOrg } from "@/hooks/useAssetPosting";

/**
 * Menu "Hợp đồng" của cổng chủ tài sản: gộp 3 nguồn theo TENANT hiện tại
 * (không gian ⇒ hồ sơ của không gian; Cá nhân ⇒ hồ sơ cá nhân).
 */

const CONSIGNMENT_LIST_SELECT =
  "id, code, status, asset_posting_id, terms, org_party, asset_snapshot, created_at, signed_at, " +
  "posting:asset_postings!consignment_contracts_asset_posting_id_fkey!inner(title, workspace_id, user_id)";

/** Hợp đồng ký gửi của tenant (kể cả đã huỷ). RLS cc_owner_read giới hạn tập dòng. */
export function useOwnerConsignmentContracts() {
  const { userId } = useAuth();
  const { workspaceId, isPersonal, tenantKey, isLoading: tenantLoading } = useOwnerWorkspace();
  return useQuery({
    queryKey: qk.ownerConsignmentContracts(userId, tenantKey),
    enabled: !!userId && !tenantLoading && !!tenantKey,
    queryFn: async (): Promise<OwnerConsignmentContractItem[]> => {
      let query = supabase.from("consignment_contracts").select(CONSIGNMENT_LIST_SELECT);
      query = isPersonal
        ? query.is("posting.workspace_id", null).eq("posting.user_id", userId!)
        : query.eq("posting.workspace_id", workspaceId!);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OwnerConsignmentContractItem[];
    },
  });
}

/** Danh sách gộp + trạng thái tải chung. */
export function useOwnerContracts() {
  const consignments = useOwnerConsignmentContracts();
  const consignmentSummary = useOwnerConsignmentSummary();
  const sales = useOwnerSaleContracts();
  const saleSummary = useOwnerSaleSummary();
  const services = useOwnerServiceContracts();

  const rows = useMemo((): ContractListRow[] => {
    const byPosting = consignmentSummary.data?.byPosting ?? {};
    const saleActions = new Map((saleSummary.data?.rows ?? []).map((r) => [r.contract_id, r.owner_action]));
    return sortContractRows([
      ...(consignments.data ?? []).map((c) => {
        const s = byPosting[c.asset_posting_id];
        // owner_action gắn theo HỒ SƠ — chỉ áp cho đúng hợp đồng đang mở của hồ sơ đó.
        return fromConsignment(c, s?.contract_id === c.id ? s.owner_action : null);
      }),
      ...(sales.data ?? []).map((c) => fromSale(c, saleActions.get(c.id))),
      ...(services.data ?? []).map(fromService),
    ]);
  }, [consignments.data, consignmentSummary.data, sales.data, saleSummary.data, services.data]);

  return {
    rows,
    isLoading: consignments.isLoading || sales.isLoading || services.isLoading,
    error: consignments.error ?? sales.error ?? services.error,
    refetch: () => {
      void consignments.refetch();
      void sales.refetch();
      void services.refetch();
    },
  };
}

/**
 * Số việc cần làm cho huy hiệu menu "Hợp đồng" — chỉ đọc 3 RPC tóm tắt (nhẹ),
 * không tải danh sách đầy đủ.
 */
export function useOwnerContractActionCount(): number {
  const sale = useOwnerSaleSummary();
  const consignment = useOwnerConsignmentSummary();
  const services = useOwnerServiceContracts();
  const consignmentCount = Object.values(consignment.data?.byPosting ?? {}).filter((r) =>
    isConsignmentContractAction(r.owner_action),
  ).length;
  const serviceCount = (services.data ?? []).filter((r) => r.needs_acceptance && r.can_accept).length;
  return (sale.data?.actionCount ?? 0) + consignmentCount + serviceCount;
}

export interface OwnerConsignmentContractView {
  contract: ConsignmentContract;
  posting: {
    id: string;
    title: string | null;
    starting_price: number | null;
    workspace_id: string | null;
    branch_id: string | null;
    user_id: string;
  };
  org: RequestOrg | null;
}

/** Một hợp đồng ký gửi cho trang chi tiết trong menu "Hợp đồng". */
export function useOwnerConsignmentContract(contractId: string | null | undefined) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.ownerConsignmentContract(userId, contractId),
    enabled: !!userId && !!contractId,
    queryFn: async (): Promise<OwnerConsignmentContractView | null> => {
      const { data, error } = await supabase
        .from("consignment_contracts")
        .select(
          "*, posting:asset_postings!consignment_contracts_asset_posting_id_fkey(id, title, starting_price, workspace_id, branch_id, user_id)",
        )
        .eq("id", contractId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { posting, ...contract } = data as unknown as ConsignmentContract & {
        posting: OwnerConsignmentContractView["posting"];
      };
      const { data: org } = await supabase
        .from("auction_organizations")
        .select("id, name, province, phone, logo_url")
        .eq("id", contract.auction_org_id)
        .maybeSingle();
      return { contract, posting, org: (org as RequestOrg | null) ?? null };
    },
  });
}

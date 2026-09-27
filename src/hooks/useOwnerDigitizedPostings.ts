import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerConsignmentSummary } from "@/hooks/useConsignmentContract";
import { qk } from "@/lib/queryKeys";
import { digitizeStatusOf, type DigitizeStatus } from "@/lib/asset-posting/digitizeStatus";
import { postingCompletionPct } from "@/components/asset-posting/wizardSchema";
import type { AssetPosting, BrokerRequestStatus, ServiceRequestStatus } from "@/types/asset-posting";
import type { ConsignmentContractStatus } from "@/types/consignment-contract";

/**
 * Hồ sơ + chuỗi ký gửi trong MỘT lượt đọc. Kiểu `string` như CONSIGNMENT_POSTING_SELECT:
 * dòng được ép về DigitizePostingRaw, không để supabase-js dựng kiểu lồng.
 */
const DIGITIZE_POSTING_SELECT: string = `
  *,
  requests:asset_service_requests(status, org:auction_organizations(name)),
  brokers:asset_broker_requests(status, created_at),
  contracts:consignment_contracts(status)
`;

type DigitizePostingRaw = AssetPosting & {
  requests: { status: ServiceRequestStatus; org: { name: string } | null }[] | null;
  brokers: { status: BrokerRequestStatus; created_at: string }[] | null;
  contracts: { status: ConsignmentContractStatus }[] | null;
};

export interface DigitizePostingRow {
  posting: AssetPosting;
  status: DigitizeStatus;
  /** % hoàn thiện — chỉ có nghĩa với bản nháp. */
  pct: number;
  sentCount: number;
  quotedCount: number;
  /** Tổ chức đã chốt (nếu có). */
  orgName: string | null;
}

/**
 * Menu "Số hoá tài sản": MỌI hồ sơ của tenant đang chọn (không gian hoặc Cá nhân),
 * kể cả nháp và đã huỷ, kèm trạng thái gộp. Thứ tự như cũ: mới tạo lên đầu.
 */
export function useOwnerDigitizedPostings() {
  const { userId } = useAuth();
  const { workspaceId, isPersonal, tenantKey, isLoading: tenantLoading } = useOwnerWorkspace();
  const { data: summary } = useOwnerConsignmentSummary();

  const query = useQuery({
    queryKey: qk.ownerDigitizePostings(userId, tenantKey),
    enabled: !!userId && !tenantLoading && !!tenantKey,
    queryFn: async (): Promise<DigitizePostingRaw[]> => {
      let q = supabase.from("asset_postings").select(DIGITIZE_POSTING_SELECT);
      // Lọc tường minh — admin đọc được mọi hồ sơ qua RLS.
      q = isPersonal ? q.is("workspace_id", null).eq("user_id", userId!) : q.eq("workspace_id", workspaceId!);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DigitizePostingRaw[];
    },
  });

  const rows = useMemo<DigitizePostingRow[]>(
    () =>
      (query.data ?? []).map(({ requests: rq, brokers: br, contracts: ct, ...posting }) => {
        const requests = rq ?? [];
        const latestBroker = [...(br ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        const status = digitizeStatusOf({
          postingStatus: posting.status,
          reviewStatus: posting.review_status,
          requestStatuses: requests.map((r) => r.status),
          brokerStatus: latestBroker?.status ?? null,
          contractStatuses: (ct ?? []).map((c) => c.status),
          ownerAction: summary?.byPosting[posting.id]?.owner_action ?? null,
        });
        const chosen = requests.find((r) => r.status === "selected" || r.status === "accepted");
        return {
          posting,
          status,
          pct: posting.status === "draft" ? postingCompletionPct(posting) : 100,
          sentCount: requests.length,
          quotedCount: requests.filter((r) => r.status === "quoted" || r.status === "selected").length,
          orgName: chosen?.org?.name ?? null,
        };
      }),
    [query.data, summary],
  );

  return { rows, isLoading: query.isLoading, error: query.error };
}

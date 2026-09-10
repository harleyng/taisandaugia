import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AssetBrokerRequest, AssetServiceRequest } from "@/types/asset-posting";
import type { RequestOrg, RequestWithOrg } from "@/hooks/useAssetPosting";

export interface ConsignmentState {
  requests: RequestWithOrg[];
  brokerRequest: AssetBrokerRequest | null;
}

/** Toàn bộ yêu cầu ký gửi của một hồ sơ, theo góc nhìn admin (RLS asr_admin_all). */
export function useAdminConsignment(postingId: string | undefined) {
  return useQuery({
    queryKey: ["admin-consignment", postingId],
    enabled: !!postingId,
    queryFn: async (): Promise<ConsignmentState> => {
      const [{ data: reqRows, error }, { data: brokerRows }] = await Promise.all([
        supabase
          .from("asset_service_requests")
          .select("*")
          .eq("asset_posting_id", postingId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("asset_broker_requests")
          .select("*")
          .eq("asset_posting_id", postingId!)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (error) throw error;

      const rows = (reqRows ?? []) as unknown as AssetServiceRequest[];
      const orgIds = [...new Set(rows.map((r) => r.auction_org_id))];

      let orgMap: Record<string, RequestOrg> = {};
      if (orgIds.length) {
        const { data: orgRows } = await supabase
          .from("auction_organizations")
          .select("id, name, province, phone, logo_url")
          .in("id", orgIds);
        orgMap = Object.fromEntries((orgRows ?? []).map((o) => [o.id, o as RequestOrg]));
      }

      return {
        requests: rows.map((r) => ({ ...r, org: orgMap[r.auction_org_id] ?? null })),
        brokerRequest: ((brokerRows ?? [])[0] as unknown as AssetBrokerRequest) ?? null,
      };
    },
  });
}

export interface DispatchArgs {
  postingId: string;
  orgs: { org_id: string; score: number | null }[];
  message?: string;
}

/**
 * Gửi hồ sơ tới nhiều tổ chức cùng lúc.
 *
 * RPC bỏ qua tổ chức chưa có tài khoản và tổ chức đã gửi rồi (UNIQUE), nên bấm
 * lại an toàn — kết quả trả về nói rõ đã gửi bao nhiêu, bỏ qua bao nhiêu.
 */
export function useDispatchServiceRequests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postingId, orgs, message }: DispatchArgs) => {
      const { data, error } = await supabase.rpc("admin_dispatch_service_requests", {
        _posting_id: postingId,
        _orgs: orgs as never,
        _message: message?.trim() || null,
      });
      if (error) throw error;
      return (data ?? {}) as { dispatched?: number; skipped?: number };
    },
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-consignment", vars.postingId] });
      const sent = res.dispatched ?? 0;
      const skipped = res.skipped ?? 0;
      if (sent === 0) {
        toast.info(
          skipped > 0
            ? `Các tổ chức đã chọn đều đã được gửi trước đó (${skipped}).`
            : "Chưa gửi được tổ chức nào.",
        );
      } else {
        toast.success(
          `Đã gửi hồ sơ tới ${sent} tổ chức${skipped > 0 ? ` (bỏ qua ${skipped} đã gửi trước đó)` : ""}.`,
        );
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Không gửi được yêu cầu tới tổ chức.");
    },
  });
}

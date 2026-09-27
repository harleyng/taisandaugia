import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useVrTourOrder } from "@/hooks/useVrTourOrders";
import { useAuthenticationOrder } from "@/hooks/useAuthenticationOrders";
import { useLegalConsultation } from "@/hooks/useLegalConsultations";
import { useAuctionConsultation } from "@/hooks/useAuctionConsultations";
import { qk } from "@/lib/queryKeys";
import { saveBlob } from "@/lib/pdf/saveBlob";
import {
  ServiceContractError,
  serviceContractFileName,
  unwrapServiceContractRpc,
  type AcceptServiceContractResult,
} from "@/lib/serviceContracts";
import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";
import type {
  OwnerServiceContractRow,
  ServiceContract,
  ServiceContractDetail,
  ServiceOrderForContract,
} from "@/types/service-contract";

/**
 * Hợp đồng cung ứng dịch vụ (HDCU). Bảng chỉ ghi thêm qua RPC
 * owner_accept_service_contract; đọc qua RLS (thành viên đọc được hồ sơ / admin)
 * hoặc RPC chuẩn hoá theo tenant.
 */

/** Hợp đồng dịch vụ + báo giá chờ đồng ý của TENANT hiện tại. */
export function useOwnerServiceContracts() {
  const { userId } = useAuth();
  const { workspaceId, tenantKey, isLoading: tenantLoading } = useOwnerWorkspace();
  return useQuery({
    queryKey: qk.serviceContracts.ownerIn(userId, tenantKey),
    enabled: !!userId && !tenantLoading && !!tenantKey,
    staleTime: 60_000,
    queryFn: async (): Promise<OwnerServiceContractRow[]> => {
      const { data, error } = await supabase.rpc("owner_service_contracts", {
        p_workspace_id: workspaceId ?? undefined,
      });
      if (error) throw error;
      return (data ?? []) as unknown as OwnerServiceContractRow[];
    },
  });
}

/** Chi tiết một hợp đồng (chủ tài sản + admin dùng chung). */
export function useServiceContractDetail(contractId: string | null | undefined) {
  return useQuery({
    queryKey: qk.serviceContracts.detail(contractId),
    enabled: !!contractId,
    queryFn: async (): Promise<ServiceContractDetail> => {
      const { data, error } = await supabase.rpc("service_contract_detail", { _contract_id: contractId! });
      if (error) throw error;
      return unwrapServiceContractRpc<ServiceContractDetail>(data);
    },
  });
}

/** Mọi lần đồng ý của MỘT đơn, mới nhất trước (báo giá lại ⇒ nhiều dòng). */
export function useOrderServiceContracts(kind: ServiceKindKey | null | undefined, orderId: string | null | undefined) {
  return useQuery({
    queryKey: qk.serviceContracts.forOrder(kind, orderId),
    enabled: !!kind && !!orderId,
    queryFn: async (): Promise<ServiceContract[]> => {
      const { data, error } = await supabase
        .from("service_contracts")
        .select("*")
        .eq("service_kind", kind!)
        .eq("order_id", orderId!)
        .order("accepted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ServiceContract[];
    },
  });
}

/** Hợp đồng khớp BÁO GIÁ HIỆN HÀNH của đơn (cùng thời điểm báo giá + cùng giá). */
export function currentServiceContract(
  contracts: readonly ServiceContract[] | undefined,
  order: Pick<ServiceOrderForContract, "quoted_at" | "quoted_price"> | null | undefined,
): ServiceContract | null {
  if (!contracts?.length || !order?.quoted_at || order.quoted_price == null) return null;
  const at = new Date(order.quoted_at).getTime();
  return (
    contracts.find((c) => new Date(c.quoted_at).getTime() === at && Number(c.price) === Number(order.quoted_price)) ??
    null
  );
}

/**
 * Một đơn dịch vụ bất kỳ, chuẩn hoá cho hộp thoại đồng ý. Gọi đủ 4 hook (luật hook)
 * nhưng chỉ bật đúng loại đang cần.
 */
export function useServiceOrder(kind: ServiceKindKey, orderId: string | null | undefined) {
  const vr = useVrTourOrder(kind === "vr-tour" ? orderId : null);
  const gd = useAuthenticationOrder(kind === "giam-dinh" ? orderId : null);
  const tvpl = useLegalConsultation(kind === "tu-van-phap-ly" ? orderId : null);
  const tvdg = useAuctionConsultation(kind === "tu-van-dau-gia" ? orderId : null);
  const q = { "vr-tour": vr, "giam-dinh": gd, "tu-van-phap-ly": tvpl, "tu-van-dau-gia": tvdg }[kind];
  const row = q.data as
    | (Omit<ServiceOrderForContract, "kind"> & { user_id: string; expert_name?: string | null })
    | null
    | undefined;
  const order: (ServiceOrderForContract & { user_id: string }) | null = row
    ? {
        kind,
        id: row.id,
        code: row.code,
        asset_posting_id: row.asset_posting_id,
        user_id: row.user_id,
        status: row.status,
        quoted_price: row.quoted_price == null ? null : Number(row.quoted_price),
        quoted_at: row.quoted_at,
        quote_expires_at: row.quote_expires_at,
        quote_note: row.quote_note,
        package_name: row.package_name,
        partner_name: row.partner_name,
        expert_name: row.expert_name ?? null,
        posting_title: row.posting_title,
      }
    : null;
  return { order, isLoading: q.isLoading, error: q.error };
}

export interface AcceptServiceContractArgs {
  kind: ServiceKindKey;
  orderId: string;
  templateId: string;
  expectedPrice: number;
}

export function useAcceptServiceContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: AcceptServiceContractArgs): Promise<AcceptServiceContractResult> => {
      const { data, error } = await supabase.rpc("owner_accept_service_contract", {
        _kind: args.kind,
        _order_id: args.orderId,
        _template_id: args.templateId,
        _expected_price: args.expectedPrice,
      });
      if (error) throw error;
      return unwrapServiceContractRpc<AcceptServiceContractResult>(data);
    },
    onSuccess: (_r, args) => {
      void qc.invalidateQueries({ queryKey: qk.serviceContracts.all });
      void qc.invalidateQueries({ queryKey: qk.serviceContracts.forOrder(args.kind, args.orderId) });
    },
    onError: (e: unknown, args) => {
      // Mẫu / báo giá vừa đổi ⇒ tải lại để người dùng đọc bản mới.
      if (e instanceof ServiceContractError && (e.reason === "template_changed" || e.reason === "quote_changed")) {
        void qc.invalidateQueries({ queryKey: qk.contractTemplates.all });
        void qc.invalidateQueries({ queryKey: qk.serviceContracts.forOrder(args.kind, args.orderId) });
      }
      toast.error(e instanceof Error && e.message ? e.message : "Không ghi nhận được lần đồng ý.");
    },
  });
}

/** Tải PDF hợp đồng đã giao kết — dựng lại từ bản chụp + mẫu bất biến. */
export async function downloadServiceContractPdf(detail: ServiceContractDetail): Promise<void> {
  const { serviceContractPdfBlob, serviceContractPdfInput } = await import("@/lib/serviceContracts/contract-pdf");
  const blob = await serviceContractPdfBlob(serviceContractPdfInput(detail));
  saveBlob(blob, serviceContractFileName(detail.contract.code));
}

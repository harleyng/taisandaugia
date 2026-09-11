import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { assertRpcOk } from "@/lib/consignment/errors";
import {
  CONTRACT_BUCKET,
  contractFilePath,
  validateContractFile,
  type ContractFileKind,
} from "@/lib/consignment/contractFiles";
import { ownerActionCount, type OwnerConsignmentSummaryRow } from "@/lib/consignment/postingBadge";
import type { ConsignmentContract, OrgContractDetail } from "@/types/consignment-contract";

/**
 * Hợp đồng dịch vụ đấu giá giữa chủ tài sản và tổ chức đã chốt.
 *
 * Chủ tài sản đọc thẳng bảng (RLS cc_owner_read). Tổ chức KHÔNG có policy đọc —
 * dòng hợp đồng chứa CCCD / địa chỉ chủ tài sản — nên đi qua RPC
 * org_consignment_contract. Mọi ghi đi qua RPC consignment_contract_* (trả
 * {ok:false, reason} ⇒ assertRpcOk).
 */

/** Bên đang thao tác + cache phải làm mới sau đó. */
export type ContractCtx =
  | { side: "owner"; postingId: string }
  | { side: "org"; requestId: string; auctionOrgId: string | null };

type ContractRef = Pick<ConsignmentContract, "id" | "organization_id">;

// ─── Tệp (bucket private) ────────────────────────────────────────────────────

export async function uploadContractFile(contract: ContractRef, kind: ContractFileKind, file: File): Promise<string> {
  const invalid = validateContractFile(file);
  if (invalid) throw new Error(invalid);
  const path = contractFilePath(contract.organization_id, contract.id, kind, file.name);
  const { error } = await supabase.storage
    .from(CONTRACT_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error("Không tải được tệp hợp đồng lên. Vui lòng thử lại.");
  return path;
}

export async function signContractFile(
  path: string,
  bucket: string = CONTRACT_BUCKET,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ─── Đọc ─────────────────────────────────────────────────────────────────────

/** Mọi hợp đồng của một hồ sơ (kể cả đã huỷ), mới nhất trước. */
export function usePostingContracts(postingId: string | null) {
  return useQuery({
    queryKey: qk.consignment.postingContracts(postingId),
    enabled: !!postingId,
    queryFn: async (): Promise<ConsignmentContract[]> => {
      const { data, error } = await supabase
        .from("consignment_contracts")
        .select("*")
        .eq("asset_posting_id", postingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ConsignmentContract[];
    },
  });
}

/** Bản chiếu hợp đồng cho tổ chức; null khi yêu cầu chưa có hợp đồng. */
export function useOrgConsignmentContract(requestId: string | null) {
  return useQuery({
    queryKey: qk.consignment.orgContract(requestId),
    enabled: !!requestId,
    queryFn: async (): Promise<OrgContractDetail | null> => {
      const { data, error } = await supabase.rpc("org_consignment_contract", { _request_id: requestId! });
      if (error) throw error;
      const res = data as { ok?: boolean; reason?: string } | null;
      if (res?.ok === false && res.reason === "no_contract") return null;
      assertRpcOk(res);
      return res as unknown as OrgContractDetail;
    },
  });
}

// ─── Ghi ─────────────────────────────────────────────────────────────────────

function useInvalidateContract(ctx: ContractCtx) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return () => {
    if (ctx.side === "owner") {
      queryClient.invalidateQueries({ queryKey: qk.consignment.postingContracts(ctx.postingId) });
      // Huỷ hợp đồng mở lại các báo giá khác ⇒ danh sách yêu cầu của hồ sơ đổi theo.
      queryClient.invalidateQueries({ queryKey: qk.postingDetail(ctx.postingId) });
      queryClient.invalidateQueries({ queryKey: qk.myPostings(userId) });
      queryClient.invalidateQueries({ queryKey: qk.consignment.ownerSummary(userId) });
    } else {
      queryClient.invalidateQueries({ queryKey: qk.consignment.orgContract(ctx.requestId) });
      queryClient.invalidateQueries({ queryKey: qk.consignment.orgRequests(ctx.auctionOrgId) });
      queryClient.invalidateQueries({ queryKey: qk.consignment.orgCounts(ctx.auctionOrgId) });
    }
  };
}

const toastError = (fallback: string) => (err: unknown) =>
  toast.error(err instanceof Error && err.message ? err.message : fallback);

export interface ShareDraftArgs {
  contract: ContractRef;
  file: File;
  contractNo?: string;
  generated?: boolean;
}

/** Tổ chức chia sẻ dự thảo. Dự thảo mới gỡ bản đã ký + mọi xác nhận trước đó. */
export function useShareContractDraft(ctx: ContractCtx) {
  const invalidate = useInvalidateContract(ctx);

  return useMutation({
    mutationFn: async ({ contract, file, contractNo, generated = false }: ShareDraftArgs) => {
      const path = await uploadContractFile(contract, "draft", file);
      const { data, error } = await supabase.rpc("consignment_contract_share_draft", {
        _contract_id: contract.id,
        _draft_doc_path: path,
        _generated: generated,
        _contract_no: contractNo?.trim() || undefined,
      });
      if (error) throw error;
      assertRpcOk(data);
      return data as { cleared_signed?: boolean };
    },
    onSuccess: (res) =>
      toast.success(
        res?.cleared_signed
          ? "Đã chia sẻ dự thảo mới. Bản đã ký trước đó bị gỡ — hai bên cần ký và xác nhận lại."
          : "Đã chia sẻ dự thảo hợp đồng với chủ tài sản.",
      ),
    onError: toastError("Không chia sẻ được dự thảo hợp đồng."),
    onSettled: invalidate,
  });
}

export interface AttachSignedArgs {
  contract: ContractRef;
  file: File;
  /** yyyy-MM-dd */
  signedDate: string;
  contractNo?: string;
  /** Xác nhận luôn phần của mình khi tải lên. */
  confirm: boolean;
}

/** Một bên tải bản scan hợp đồng đã ký. Bản mới xoá mọi xác nhận trước đó. */
export function useAttachSignedContract(ctx: ContractCtx) {
  const invalidate = useInvalidateContract(ctx);

  return useMutation({
    mutationFn: async ({ contract, file, signedDate, contractNo, confirm }: AttachSignedArgs) => {
      const path = await uploadContractFile(contract, "signed", file);
      const { data, error } = await supabase.rpc("consignment_contract_attach_signed", {
        _contract_id: contract.id,
        _side: ctx.side,
        _signed_doc_path: path,
        _signed_date: signedDate,
        _contract_no: contractNo?.trim() || undefined,
        _confirm: confirm,
      });
      if (error) throw error;
      assertRpcOk(data);
      return { confirm };
    },
    onSuccess: ({ confirm }) =>
      toast.success(
        confirm
          ? "Đã tải bản hợp đồng đã ký và xác nhận. Chờ bên còn lại xác nhận."
          : "Đã tải bản hợp đồng đã ký. Hai bên cần xác nhận trên sàn.",
      ),
    onError: toastError("Không tải được bản hợp đồng đã ký."),
    onSettled: invalidate,
  });
}

/** Xác nhận bản đã ký. Gửi kèm ĐÚNG path đang xem — tệp bị thay thì server từ chối. */
export function useConfirmContract(ctx: ContractCtx) {
  const invalidate = useInvalidateContract(ctx);

  return useMutation({
    mutationFn: async ({ contractId, signedDocPath }: { contractId: string; signedDocPath: string }) => {
      const { data, error } = await supabase.rpc("consignment_contract_confirm", {
        _contract_id: contractId,
        _side: ctx.side,
        _signed_doc_path: signedDocPath,
      });
      if (error) throw error;
      assertRpcOk(data);
      return data as { status?: string };
    },
    onSuccess: (res) =>
      toast.success(
        res?.status === "signed"
          ? "Hợp đồng đã được hai bên xác nhận ký."
          : "Đã xác nhận bản đã ký. Chờ bên còn lại xác nhận.",
      ),
    onError: toastError("Không xác nhận được hợp đồng."),
    onSettled: invalidate,
  });
}

/** Huỷ hợp đồng chưa ký. Chủ tài sản: các báo giá khác mở lại để chọn tiếp. */
export function useCancelContract(ctx: ContractCtx) {
  const invalidate = useInvalidateContract(ctx);

  return useMutation({
    mutationFn: async ({ contractId, reason }: { contractId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("consignment_contract_cancel", {
        _contract_id: contractId,
        _side: ctx.side,
        _reason: reason.trim(),
      });
      if (error) throw error;
      assertRpcOk(data);
      return data as { reopened?: number };
    },
    onSuccess: (res) => {
      if (ctx.side === "org") {
        toast.success("Đã huỷ hợp đồng với chủ tài sản.");
      } else if ((res?.reopened ?? 0) > 0) {
        toast.success(`Đã huỷ hợp đồng. ${res.reopened} yêu cầu / báo giá khác đã mở lại để bạn chọn.`);
      } else {
        toast.success("Đã huỷ hợp đồng. Bạn có thể gửi hồ sơ cho tổ chức khác.");
      }
    },
    onError: toastError("Không huỷ được hợp đồng."),
    onSettled: invalidate,
  });
}

// ─── Địa chỉ chủ tài sản (Bên A) ─────────────────────────────────────────────

export interface OwnerKycAddress {
  kind: "individual" | "organization";
  address: string | null;
  ward: string | null;
  province: string | null;
}

/** Địa chỉ trên KYC đã duyệt — CÙNG thứ tự với consignment_owner_party(): tổ chức trước. */
export function useOwnerKycAddress() {
  const { userId } = useAuth();

  return useQuery({
    queryKey: qk.consignment.ownerKycAddress(userId),
    enabled: !!userId,
    queryFn: async (): Promise<OwnerKycAddress | null> => {
      const org = await supabase
        .from("asset_owner_org_kyc")
        .select("head_office_address, head_office_province")
        .eq("created_by", userId!)
        .eq("status", "approved")
        .maybeSingle();
      if (org.error) throw org.error;
      if (org.data) {
        return {
          kind: "organization",
          address: org.data.head_office_address,
          ward: null,
          province: org.data.head_office_province,
        };
      }

      const ind = await supabase
        .from("asset_owner_kyc")
        .select("address, ward, province")
        .eq("user_id", userId!)
        .eq("status", "approved")
        .maybeSingle();
      if (ind.error) throw ind.error;
      return ind.data ? { kind: "individual", ...ind.data } : null;
    },
  });
}

export interface UpdateOwnerAddressArgs {
  kind: OwnerKycAddress["kind"];
  address: string;
  ward?: string;
  province?: string;
}

/** Sửa địa chỉ trên KYC đã duyệt (RPC chỉ chạm cột địa chỉ). */
export function useUpdateOwnerAddress() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return useMutation({
    mutationFn: async ({ kind, address, ward, province }: UpdateOwnerAddressArgs) => {
      const { data, error } = await supabase.rpc("owner_update_kyc_address", {
        _kind: kind,
        _address: address.trim(),
        _ward: ward?.trim() || undefined,
        _province: province?.trim() || undefined,
      });
      if (error) throw error;
      assertRpcOk(data);
    },
    onSuccess: () => toast.success("Đã lưu địa chỉ. Tổ chức đấu giá sẽ dùng địa chỉ này trong hợp đồng."),
    onError: toastError("Không lưu được địa chỉ."),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.consignment.ownerKycAddress(userId) });
      // Bổ sung địa chỉ gỡ việc "Cần bổ sung địa chỉ" khỏi badge.
      queryClient.invalidateQueries({ queryKey: qk.consignment.ownerSummary(userId) });
    },
  });
}

// ─── Việc đang chờ (badge) ───────────────────────────────────────────────────

export interface OwnerConsignmentSummary {
  byPosting: Record<string, OwnerConsignmentSummaryRow>;
  /** Số hồ sơ chủ tài sản đang phải làm gì đó — badge nav. */
  actionCount: number;
}

/** Tóm tắt ký gửi theo hồ sơ của chủ tài sản (RPC owner_consignment_summary, SECURITY INVOKER). */
export function useOwnerConsignmentSummary() {
  const { userId } = useAuth();

  return useQuery({
    queryKey: qk.consignment.ownerSummary(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<OwnerConsignmentSummary> => {
      const { data, error } = await supabase.rpc("owner_consignment_summary");
      if (error) throw error;
      const rows = (data ?? []) as unknown as OwnerConsignmentSummaryRow[];
      return {
        byPosting: Object.fromEntries(rows.map((r) => [r.posting_id, r])),
        actionCount: ownerActionCount(rows),
      };
    },
  });
}

// ─── Dự thảo tự sinh ─────────────────────────────────────────────────────────

/**
 * Dựng PDF dự thảo từ bản chiếu hợp đồng của tổ chức. Nạp ĐỘNG renderer
 * (pdfmake + font ~2MB) — chỉ khi người dùng bấm tạo.
 */
export async function generateContractDraftFile(
  detail: OrgContractDetail,
  categoryLabel: string | null,
): Promise<File> {
  const [{ buildContractPdfInput, contractDraftFileName }, { contractPdfBlob }] = await Promise.all([
    import("@/lib/consignment/contract-pdf/input"),
    import("@/lib/consignment/contract-pdf"),
  ]);
  const input = buildContractPdfInput(detail, { categoryLabel });
  const blob = await contractPdfBlob(input);
  return new File([blob], contractDraftFileName(input), { type: "application/pdf" });
}

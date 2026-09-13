import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { assertSaleRpcOk, saleErrorMessage } from "@/lib/saleContracts/errors";
import {
  SALE_BUCKET,
  saleObjectPath,
  validateSaleFile,
  type SaleFileKind,
} from "@/lib/saleContracts/files";
import type {
  CancelSaleContractOk,
  ConfirmHandoverOk,
  CreateSaleContractOk,
  OrgSaleContractCounts,
  OwnerSaleContractRow,
  RecordSalePaymentOk,
  ReverseSalePaymentOk,
  SaleCancelKind,
  SaleContract,
  SaleContractDetail,
  SalePaymentMethod,
  SaleSide,
  SaleTitleTransferStatus,
} from "@/types/auction-sale-contract";
import type { MoneyInstallment } from "@/lib/saleContracts/money";

/**
 * Hợp đồng mua bán tài sản đấu giá (giai đoạn sau khi phiên chốt kết quả).
 *
 * Bảng do 20260914000001 sở hữu và CHỈ CHO ĐỌC: mọi thay đổi đi qua RPC
 * `sale_contract_*` / `org_*_sale_*`, trả `{ok:false, reason}` ⇒ bắt buộc
 * assertSaleRpcOk, nếu không một lần thu tiền thất bại vẫn hiện toast xanh.
 *
 * RLS cho bên mua, bên bán (chủ tài sản có tài khoản) và thành viên tổ chức
 * thấy đúng dòng của mình, nên danh sách đọc THẲNG bảng; riêng trang chi tiết
 * đi qua RPC `sale_contract_detail` để lấy luôn kỳ hạn, sổ tiền, nhật ký và
 * quyền thao tác trong MỘT vòng gọi.
 *
 * ⚠️ Mọi hook phía tổ chức nhận `organization_id` CỦA BẢN GHI, không phải của
 * OrgSwitcher — một hợp đồng mở bằng đường link có thể thuộc tổ chức khác.
 */

const showError = (err: unknown) => toast.error(saleErrorMessage(err));

// ─── Tệp (bucket private) ────────────────────────────────────────────────────

export async function uploadSaleFile(
  contract: Pick<SaleContract, "id" | "organization_id">,
  kind: SaleFileKind,
  file: File,
): Promise<string> {
  const invalid = validateSaleFile(file);
  if (invalid) throw new Error(invalid);
  const path = saleObjectPath(contract.organization_id, contract.id, kind, file.name);
  const { error } = await supabase.storage
    .from(SALE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error("Không tải được tệp lên. Vui lòng thử lại.");
  return path;
}

/** Bucket private ⇒ chỉ mở được bằng URL đã ký. Trả null thay vì ném để UI hiện "không mở được". */
export async function signSaleFile(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(SALE_BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ─── Đọc ─────────────────────────────────────────────────────────────────────

const LIST_SELECT = "*";

/** Danh sách hợp đồng của MỘT tổ chức. */
export function useOrgSaleContracts(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: qk.saleContracts.byOrg(organizationId),
    enabled: !!organizationId,
    queryFn: async (): Promise<SaleContract[]> => {
      const { data, error } = await supabase
        .from("auction_sale_contracts")
        .select(LIST_SELECT)
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SaleContract[];
    },
  });
}

/** Trang chi tiết: hợp đồng + kỳ hạn + sổ tiền + nhật ký + quyền, một vòng gọi. */
export function useSaleContractDetail(contractId: string | null | undefined) {
  return useQuery({
    queryKey: qk.saleContracts.detail(contractId),
    enabled: !!contractId,
    queryFn: async (): Promise<SaleContractDetail> => {
      const { data, error } = await supabase.rpc("sale_contract_detail", {
        _contract_id: contractId!,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data as unknown as SaleContractDetail;
    },
  });
}

/** Hợp đồng mà người đang đăng nhập là BÊN MUA. */
export function useMySaleContracts() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.saleContracts.mine(userId),
    enabled: !!userId,
    queryFn: async (): Promise<SaleContract[]> => {
      const { data, error } = await supabase
        .from("auction_sale_contracts")
        .select(LIST_SELECT)
        .eq("buyer_user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SaleContract[];
    },
  });
}

/** Hợp đồng mà người đang đăng nhập là BÊN BÁN (chủ tài sản có tài khoản). */
export function useOwnerSaleContracts() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.saleContracts.ownerMine(userId),
    enabled: !!userId,
    queryFn: async (): Promise<SaleContract[]> => {
      const { data, error } = await supabase
        .from("auction_sale_contracts")
        .select(LIST_SELECT)
        .eq("seller_user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SaleContract[];
    },
  });
}

/** Việc cần làm phía chủ tài sản — nguồn của huy hiệu trong cổng chủ tài sản. */
export function useOwnerSaleSummary() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: [...qk.saleContracts.ownerMine(userId), "summary"] as const,
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ rows: OwnerSaleContractRow[]; actionCount: number }> => {
      const { data, error } = await supabase.rpc("owner_sale_contract_summary");
      if (error) throw error;
      const rows = (data ?? []) as unknown as OwnerSaleContractRow[];
      return { rows, actionCount: rows.filter((r) => r.owner_action !== "none").length };
    },
  });
}

/** Huy hiệu điều hướng của tổ chức. */
export function useOrgSaleContractCounts(organizationId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.saleContracts.counts(organizationId),
    enabled: !!organizationId && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<OrgSaleContractCounts> => {
      const { data, error } = await supabase.rpc("org_sale_contract_counts", {
        _organization_id: organizationId!,
      });
      if (error) throw error;
      return data as unknown as OrgSaleContractCounts;
    },
  });
}

// ─── Ghi ─────────────────────────────────────────────────────────────────────

/**
 * Một lần ghi chạm hợp đồng, kỳ hạn, sổ tiền VÀ trạng thái lô + tiền đặt trước
 * của phiên, nên luôn làm mới cả ba nhóm key.
 */
function useInvalidateSale() {
  const qc = useQueryClient();
  return (sessionId?: string | null) => {
    void qc.invalidateQueries({ queryKey: qk.saleContracts.all });
    void qc.invalidateQueries({ queryKey: qk.biddingContracts.all });
    if (sessionId) void qc.invalidateQueries({ queryKey: qk.bidding.all(sessionId) });
  };
}

export interface CreateSaleContractArgs {
  lotId: string;
  sessionId?: string | null;
  payeeSide?: "seller" | "org";
  orgSigns?: boolean;
  signDueAt?: string | null;
}

export function useCreateSaleContract() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: CreateSaleContractArgs): Promise<CreateSaleContractOk> => {
      const { data, error } = await supabase.rpc("org_create_sale_contract", {
        _lot_id: a.lotId,
        _payee_side: a.payeeSide ?? undefined,
        _org_signs: a.orgSigns ?? undefined,
        _sign_due_at: a.signDueAt ?? undefined,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data as unknown as CreateSaleContractOk;
    },
    onSuccess: (res) => toast.success(`Đã lập hợp đồng mua bán ${res.code ?? ""}`.trim()),
    onError: showError,
    onSettled: (_d, _e, a) => invalidate(a.sessionId),
  });
}

export interface SetSaleTermsArgs {
  contractId: string;
  installments?: MoneyInstallment[] | null;
  handoverDueAt?: string | null;
  payeeSide?: "seller" | "org" | null;
  payeeBankInfo?: string | null;
  notarizationRequired?: boolean | null;
  contractNo?: string | null;
  signDueAt?: string | null;
  orgSigns?: boolean | null;
}

export function useSetSaleTerms() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: SetSaleTermsArgs) => {
      const { data, error } = await supabase.rpc("sale_contract_set_terms", {
        _contract_id: a.contractId,
        _installments: a.installments
          ? (a.installments.map((i) => ({
              label: i.label ?? null,
              due_at: i.due_at ?? null,
              amount: i.amount,
            })) as unknown as never)
          : undefined,
        _handover_due_at: a.handoverDueAt ?? undefined,
        _payee_side: a.payeeSide ?? undefined,
        _payee_bank_info: a.payeeBankInfo ?? undefined,
        _notarization_required: a.notarizationRequired ?? undefined,
        _contract_no: a.contractNo ?? undefined,
        _sign_due_at: a.signDueAt ?? undefined,
        _org_signs: a.orgSigns ?? undefined,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data;
    },
    onSuccess: () => toast.success("Đã cập nhật điều khoản hợp đồng"),
    onError: showError,
    onSettled: () => invalidate(),
  });
}

export interface ShareSaleDraftArgs {
  contract: Pick<SaleContract, "id" | "organization_id">;
  file: File;
  generated?: boolean;
}

export function useShareSaleDraft() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: ShareSaleDraftArgs) => {
      // Tải tệp TRƯỚC rồi mới gọi RPC — không nguyên tử, nên khi RPC lỗi thì
      // chỉ gọi lại RPC: tệp là bất biến, bản mồ côi không bao giờ hiện ra.
      const path = await uploadSaleFile(a.contract, "draft", a.file);
      const { data, error } = await supabase.rpc("sale_contract_share_draft", {
        _contract_id: a.contract.id,
        _draft_doc_path: path,
        _generated: a.generated ?? false,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data as unknown as { ok: true; cleared_signed: boolean };
    },
    onSuccess: (res) =>
      toast.success(
        res.cleared_signed
          ? "Đã chia sẻ dự thảo mới — bản đã ký cũ và các xác nhận đã được xoá"
          : "Đã chia sẻ dự thảo tới các bên",
      ),
    onError: showError,
    onSettled: () => invalidate(),
  });
}

export interface AttachSignedSaleArgs {
  contract: Pick<SaleContract, "id" | "organization_id">;
  side: SaleSide;
  file: File;
  signedDate: string;
  contractNo?: string | null;
  confirm?: boolean;
}

export function useAttachSignedSale() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: AttachSignedSaleArgs) => {
      const path = await uploadSaleFile(a.contract, "signed", a.file);
      const { data, error } = await supabase.rpc("sale_contract_attach_signed", {
        _contract_id: a.contract.id,
        _side: a.side,
        _signed_doc_path: path,
        _signed_date: a.signedDate,
        _contract_no: a.contractNo ?? undefined,
        _confirm: a.confirm ?? false,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data;
    },
    onSuccess: () => toast.success("Đã tải lên bản hợp đồng đã ký"),
    onError: showError,
    onSettled: () => invalidate(),
  });
}

export function useConfirmSaleSigned() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: { contractId: string; side: SaleSide; signedDocPath: string }) => {
      // Gửi lại ĐÚNG đường dẫn đang hiển thị để server bắt được `document_changed`.
      const { data, error } = await supabase.rpc("sale_contract_confirm", {
        _contract_id: a.contractId,
        _side: a.side,
        _signed_doc_path: a.signedDocPath,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data as unknown as { ok: true; status: string };
    },
    onSuccess: (res) =>
      toast.success(
        res.status === "signed" ? "Hợp đồng đã được các bên xác nhận" : "Đã ghi nhận xác nhận của bạn",
      ),
    onError: showError,
    onSettled: () => invalidate(),
  });
}

export function useCancelSaleContract() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: {
      contractId: string;
      side: SaleSide;
      kind: SaleCancelKind;
      reason: string;
      sessionId?: string | null;
    }): Promise<CancelSaleContractOk> => {
      const { data, error } = await supabase.rpc("sale_contract_cancel", {
        _contract_id: a.contractId,
        _side: a.side,
        _kind: a.kind,
        _reason: a.reason,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data as unknown as CancelSaleContractOk;
    },
    onSuccess: (res) =>
      toast.success(
        res.deposit_forfeited
          ? "Đã huỷ hợp đồng — tiền đặt trước của người trúng bị mất"
          : res.deposit_pending_refund
            ? "Đã huỷ hợp đồng — tiền đặt trước chuyển sang chờ hoàn trả"
            : "Đã huỷ hợp đồng",
      ),
    onError: showError,
    onSettled: (_d, _e, a) => invalidate(a.sessionId),
  });
}

export interface RecordSalePaymentArgs {
  contractId: string;
  amount: number;
  method: SalePaymentMethod;
  txnRef?: string | null;
  receivedAt?: string | null;
  evidencePath?: string | null;
  note?: string | null;
  sessionId?: string | null;
}

export function useRecordSalePayment() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: RecordSalePaymentArgs): Promise<RecordSalePaymentOk> => {
      const { data, error } = await supabase.rpc("org_record_sale_payment", {
        _contract_id: a.contractId,
        _amount: a.amount,
        _method: a.method,
        _txn_ref: a.txnRef ?? undefined,
        _received_at: a.receivedAt ?? undefined,
        _evidence_path: a.evidencePath ?? undefined,
        _note: a.note ?? undefined,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data as unknown as RecordSalePaymentOk;
    },
    onSuccess: (res) =>
      toast.success(res.settled ? "Đã ghi nhận — hợp đồng đã thanh toán đủ" : "Đã ghi nhận khoản thu"),
    onError: showError,
    onSettled: (_d, _e, a) => invalidate(a.sessionId),
  });
}

export function useReverseSalePayment() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: {
      paymentId: string;
      reason: string;
      sessionId?: string | null;
    }): Promise<ReverseSalePaymentOk> => {
      const { data, error } = await supabase.rpc("org_reverse_sale_payment", {
        _payment_id: a.paymentId,
        _reason: a.reason,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data as unknown as ReverseSalePaymentOk;
    },
    onSuccess: () => toast.success("Đã hoàn bút toán"),
    onError: showError,
    onSettled: (_d, _e, a) => invalidate(a.sessionId),
  });
}

export function useScheduleSaleHandover() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: { contractId: string; handoverAt: string; location?: string | null }) => {
      const { data, error } = await supabase.rpc("sale_contract_schedule_handover", {
        _contract_id: a.contractId,
        _handover_at: a.handoverAt,
        _location: a.location ?? undefined,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data;
    },
    onSuccess: () => toast.success("Đã hẹn lịch bàn giao tài sản"),
    onError: showError,
    onSettled: () => invalidate(),
  });
}

export function useConfirmSaleHandover() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: {
      contract: Pick<SaleContract, "id" | "organization_id">;
      side: SaleSide;
      file?: File | null;
      sessionId?: string | null;
    }): Promise<ConfirmHandoverOk> => {
      const path = a.file ? await uploadSaleFile(a.contract, "handover", a.file) : null;
      const { data, error } = await supabase.rpc("sale_contract_confirm_handover", {
        _contract_id: a.contract.id,
        _side: a.side,
        _doc_path: path ?? undefined,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data as unknown as ConfirmHandoverOk;
    },
    onSuccess: (res) =>
      toast.success(
        res.completed
          ? "Đã bàn giao — hợp đồng hoàn tất"
          : res.handed_over
            ? "Hai bên đã xác nhận bàn giao tài sản"
            : "Đã ghi nhận xác nhận bàn giao của bạn",
      ),
    onError: showError,
    onSettled: (_d, _e, a) => invalidate(a.sessionId),
  });
}

export function useSetSaleTitleTransfer() {
  const invalidate = useInvalidateSale();
  return useMutation({
    mutationFn: async (a: {
      contract: Pick<SaleContract, "id" | "organization_id">;
      status: SaleTitleTransferStatus;
      note?: string | null;
      file?: File | null;
    }) => {
      const path = a.file ? await uploadSaleFile(a.contract, "title", a.file) : null;
      const { data, error } = await supabase.rpc("sale_contract_set_title_transfer", {
        _contract_id: a.contract.id,
        _status: a.status,
        _note: a.note ?? undefined,
        _doc_path: path ?? undefined,
      });
      if (error) throw error;
      assertSaleRpcOk(data);
      return data;
    },
    onSuccess: () => toast.success("Đã cập nhật tiến độ sang tên"),
    onError: showError,
    onSettled: () => invalidate(),
  });
}

/** Dựng dự thảo PDF từ bản chiếu hợp đồng — nạp ĐỘNG pdfmake (~2MB). */
export async function generateSaleDraftFile(
  detail: Pick<SaleContractDetail, "contract" | "installments">,
  categoryLabel?: string | null,
): Promise<File> {
  const [{ salePdfBlob }, { buildSalePdfInput, saleDraftFileName }] = await Promise.all([
    import("@/lib/saleContracts/contract-pdf"),
    import("@/lib/saleContracts/contract-pdf/input"),
  ]);
  const input = buildSalePdfInput(detail, { categoryLabel });
  const blob = await salePdfBlob(input);
  return new File([blob], saleDraftFileName(input), { type: "application/pdf" });
}

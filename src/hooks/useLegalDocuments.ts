import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { APP_PLATFORM } from "@/lib/appPlatform";
import type {
  LegalActiveVersions,
  LegalConsent,
  LegalDocType,
  LegalDocument,
  LegalPlatform,
  LegalVersionCreate,
} from "@/types/legal";

// Mọi đọc/ghi đi qua RPC theo nền tảng (migration 20261019100000): đọc thẳng bảng
// `legal_documents` giờ chỉ thấy văn bản của Tài Sản Đấu Giá — lối cũ giữ cho bản
// production chưa deploy lại, không dùng cho code mới.

/**
 * Phiên bản đang áp dụng cho mỗi loại của một nền tảng (anon OK). LEAN — không kèm
 * `content` vì hook này chạy ở mọi trang (login text + cổng consent). Query key
 * `["legal-active-versions", platform]`.
 */
export function useLegalActiveVersions(platform: LegalPlatform = APP_PLATFORM) {
  return useQuery<LegalActiveVersions>({
    queryKey: ["legal-active-versions", platform],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("legal_active_versions", { p_platform: platform });
      if (error) throw error;
      const pick = (type: LegalDocType) => (data ?? []).find((r) => r.doc_type === type) ?? null;
      const t = pick("terms");
      const p = pick("privacy");
      return {
        terms: t?.version ?? null,
        privacy: p?.version ?? null,
        termsEffectiveDate: t?.effective_date ?? null,
        privacyEffectiveDate: p?.effective_date ?? null,
      };
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Phiên bản đang áp dụng KÈM nội dung, cho trang công khai render. Query key
 * `["legal-active-doc", platform, docType]`.
 */
export function useActiveLegalDoc(docType: LegalDocType, platform: LegalPlatform = APP_PLATFORM) {
  return useQuery<LegalDocument | null>({
    queryKey: ["legal-active-doc", platform, docType],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("legal_active_document", {
        p_platform: platform,
        p_doc_type: docType,
      });
      if (error) throw error;
      return ((data ?? [])[0] as LegalDocument | undefined) ?? null;
    },
    staleTime: 5 * 60_000,
  });
}

/** Query key consent của user trên một nền tảng. */
export const legalConsentKey = (platform: LegalPlatform, userId: string | null | undefined) =>
  ["legal-consent", platform, userId] as const;

/**
 * Phiên bản user đã đồng ý trên một nền tảng (null = chưa ghi nhận lần nào). Chỗ
 * lưu khác nhau theo nền tảng — RPC `my_legal_consent` che đi.
 */
export function useMyLegalConsent(userId: string | null | undefined, platform: LegalPlatform = APP_PLATFORM) {
  return useQuery<LegalConsent | null>({
    queryKey: legalConsentKey(platform, userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_legal_consent", { p_platform: platform });
      if (error) throw error;
      const row = (data ?? [])[0];
      return row ? { termsVersion: row.terms_version, privacyVersion: row.privacy_version } : null;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

/**
 * Admin: tất cả phiên bản (cả bản Chờ áp dụng) của một nền tảng, hoặc cả hai khi
 * bỏ trống. Query key `["legal-documents", platform | "all"]`.
 */
export function useLegalDocuments(platform?: LegalPlatform) {
  return useQuery<LegalDocument[]>({
    queryKey: ["legal-documents", platform ?? "all"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_legal_documents", { p_platform: platform });
      if (error) throw error;
      return (data ?? []) as LegalDocument[];
    },
  });
}

/** Admin: một phiên bản theo id (trang chi tiết / nguồn nhân bản). */
export function useLegalVersion(id: string | undefined) {
  return useQuery<LegalDocument | null>({
    queryKey: ["legal-document", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_legal_document", { p_id: id! });
      if (error) throw error;
      return ((data ?? [])[0] as LegalDocument | undefined) ?? null;
    },
    enabled: !!id,
  });
}

/**
 * Tạo phiên bản MỚI. Phiên bản là bất biến — chỉ tạo, không update/xoá.
 * Invalidate cả danh sách lẫn các query "đang áp dụng".
 */
export function useCreateLegalVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LegalVersionCreate) => {
      const { data, error } = await supabase.rpc("admin_create_legal_version", {
        p_platform: payload.platform,
        p_doc_type: payload.doc_type,
        p_version: payload.version,
        p_effective_date: payload.effective_date,
        p_changelog: payload.changelog ?? undefined,
        p_content: payload.content ?? undefined,
      });
      if (error) throw error;
      return data as unknown as LegalDocument;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal-documents"] });
      qc.invalidateQueries({ queryKey: ["legal-active-versions"] });
      qc.invalidateQueries({ queryKey: ["legal-active-doc"] });
      toast.success("Đã tạo phiên bản mới");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      toast.error(`Tạo phiên bản thất bại: ${msg}`);
    },
  });
}

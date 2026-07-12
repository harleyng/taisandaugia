import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type {
  LegalActiveVersions,
  LegalDocType,
  LegalDocument,
  LegalVersionCreate,
} from "@/types/legal";

/** Ngày hôm nay dạng "YYYY-MM-DD" (so khớp cột effective_date kiểu DATE). */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Phiên bản đang áp dụng cho mỗi loại (public đọc được, anon OK). LEAN — không kèm
 * `content` vì hook này chạy ở mọi trang (login text + cổng consent). Query key
 * `["legal-active-versions"]`.
 */
export function useLegalActiveVersions() {
  return useQuery<LegalActiveVersions>({
    queryKey: ["legal-active-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_documents")
        .select("doc_type, version, effective_date")
        .order("effective_date", { ascending: false });
      if (error) throw error;

      const today = todayStr();
      const pick = (type: LegalDocType) =>
        (data ?? []).find((r) => r.doc_type === type && r.effective_date <= today) ?? null;

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
 * Phiên bản đang áp dụng KÈM nội dung, cho trang công khai render. Chọn hàng
 * `effective_date <= hôm nay` mới nhất của một loại. Query key `["legal-active-doc", docType]`.
 */
export function useActiveLegalDoc(docType: LegalDocType) {
  return useQuery<LegalDocument | null>({
    queryKey: ["legal-active-doc", docType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_documents")
        .select("*")
        .eq("doc_type", docType)
        .lte("effective_date", todayStr())
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as LegalDocument | null) ?? null;
    },
    staleTime: 5 * 60_000,
  });
}

/** Admin: tất cả phiên bản của cả hai loại (mới nhất trước). Query key `["legal-documents"]`. */
export function useLegalDocuments() {
  return useQuery<LegalDocument[]>({
    queryKey: ["legal-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_documents")
        .select("*")
        .order("doc_type", { ascending: true })
        .order("effective_date", { ascending: false });
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
      const { data, error } = await supabase
        .from("legal_documents")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as LegalDocument | null) ?? null;
    },
    enabled: !!id,
  });
}

/**
 * Tạo phiên bản MỚI. Phiên bản là bất biến — chỉ INSERT, không update/xoá.
 * Invalidate cả danh sách lẫn các query "đang áp dụng".
 */
export function useCreateLegalVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LegalVersionCreate) => {
      const { data, error } = await supabase
        .from("legal_documents")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as LegalDocument;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["legal-documents"] });
      qc.invalidateQueries({ queryKey: ["legal-active-versions"] });
      qc.invalidateQueries({ queryKey: ["legal-active-doc", row.doc_type] });
      toast.success("Đã tạo phiên bản mới");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      toast.error(`Tạo phiên bản thất bại: ${msg}`);
    },
  });
}

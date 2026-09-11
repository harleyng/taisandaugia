import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ExtractedClause } from "@/lib/caseQa/caseExtraction";
import { caseQaErrorMessage } from "@/lib/caseQa/errors";
import { stripViDiacritics } from "@/lib/normalizeVi";
import { qk } from "@/lib/queryKeys";
import type { ReviewStatus, UploadableDocType } from "@/types/case-qa";
import type { CaseDocument, CaseDocumentWithClauses } from "@/types/case-chat";

/**
 * Tài liệu phiên + điều khoản trong /portal (module quyền `phien-dau-gia`).
 *
 * Ranh giới thật là RLS + trigger ở 20260912000100: trigger tự điền tổ chức, chặn
 * đường dẫn tệp sai, đưa điều khoản đã xác nhận về nháp khi sửa nội dung, và CHECK
 * chặn xác nhận điều khoản còn `[[CẦN NHẬP]]`. Mọi thay đổi làm mới prefix
 * qk.caseQa.bySession — phủ cả danh sách tài liệu lẫn điều khoản citable.
 */

const BUCKET = "case-documents";
export const CASE_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const CASE_DOC_ACCEPT = ["application/pdf", "image/jpeg", "image/png"] as const;

export function useCaseDocuments(sessionId?: string | null) {
  return useQuery({
    queryKey: qk.caseQa.documents(sessionId),
    enabled: !!sessionId,
    queryFn: async (): Promise<CaseDocumentWithClauses[]> => {
      const { data, error } = await supabase
        .from("case_documents")
        .select("*, case_document_clauses(*)")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((doc) => ({
        ...doc,
        case_document_clauses: [...(doc.case_document_clauses ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
        ),
      })) as unknown as CaseDocumentWithClauses[];
    },
  });
}

export async function signCaseDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

function safeFileName(name: string): string {
  const cleaned = stripViDiacritics(name).replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-80).replace(/^[-.]+/, "") || "tai-lieu.pdf";
}

export function validateCaseDocFile(file: File): string | null {
  if (!(CASE_DOC_ACCEPT as readonly string[]).includes(file.type)) return "Chỉ nhận tệp PDF, JPG hoặc PNG.";
  if (file.size > CASE_DOC_MAX_BYTES) return "Tệp vượt quá 10MB.";
  return null;
}

function useInvalidateCase() {
  const queryClient = useQueryClient();
  return (sessionId: string) => queryClient.invalidateQueries({ queryKey: qk.caseQa.bySession(sessionId) });
}

const onError = (err: unknown) => toast.error(caseQaErrorMessage(err));

interface SaveFileArgs {
  session: { id: string; organization_id: string };
  docType: UploadableDocType;
  title: string;
  file: File;
  /** Có sẵn tài liệu loại này ⇒ thay tệp (trigger đưa tài liệu + điều khoản về nháp). */
  existing?: CaseDocument | null;
}

export function useSaveCaseDocumentFile() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: async ({ session, docType, title, file, existing }: SaveFileArgs) => {
      const invalid = validateCaseDocFile(file);
      if (invalid) throw new Error(invalid);

      const docId = existing?.id ?? crypto.randomUUID();
      // Tiền tố thời gian: thay tệp không đè object cũ khi tên tệp trùng.
      const path = `${session.organization_id}/${session.id}/${docId}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const fileFields = {
        storage_path: path,
        original_filename: file.name,
        size_bytes: file.size,
        mime_type: file.type,
        title: title.trim(),
      };

      const { error } = existing
        ? await supabase.from("case_documents").update(fileFields).eq("id", existing.id).select("id").single()
        : await supabase
            .from("case_documents")
            .insert({ id: docId, organization_id: session.organization_id, session_id: session.id, doc_type: docType, ...fileFields })
            .select("id")
            .single();

      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      if (existing?.storage_path) await supabase.storage.from(BUCKET).remove([existing.storage_path]);
      return { sessionId: session.id, replaced: !!existing };
    },
    onSuccess: ({ sessionId, replaced }) => {
      invalidate(sessionId);
      toast.success(replaced ? "Đã thay tệp — tài liệu và điều khoản trở về nháp." : "Đã tải tài liệu lên.");
    },
    onError,
  });
}

export function useDeleteCaseDocument() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: async (doc: CaseDocument) => {
      const { data, error } = await supabase.from("case_documents").delete().eq("id", doc.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Không xoá được tài liệu này.");
      if (doc.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path]);
      return doc.session_id;
    },
    onSuccess: (sessionId) => {
      invalidate(sessionId);
      toast.success("Đã xoá tài liệu phiên.");
    },
    onError,
  });
}

export function useSaveExtractedClauses() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: async (args: { sessionId: string; documentId: string; clauses: ExtractedClause[]; engine: string }) => {
      const { data, error } = await supabase.rpc("org_save_extracted_clauses", {
        _document_id: args.documentId,
        _clauses: args.clauses as unknown as Json,
        _engine: args.engine,
      });
      if (error) throw error;
      return { sessionId: args.sessionId, count: data ?? 0 };
    },
    onSuccess: ({ sessionId }) => invalidate(sessionId),
  });
}

export interface ClauseDraft {
  id?: string;
  clause_ref: string;
  heading: string;
  body: string;
  topics: string[];
  sort_order: number;
}

export function useSaveCaseClause() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: async ({ doc, clause, confirm }: { doc: CaseDocument; clause: ClauseDraft; confirm: boolean }) => {
      const fields = {
        clause_ref: clause.clause_ref.trim(),
        heading: clause.heading.trim() || null,
        body: clause.body.trim(),
        topics: clause.topics,
        sort_order: clause.sort_order,
      };
      let id = clause.id;
      if (id) {
        const { error } = await supabase.from("case_document_clauses").update(fields).eq("id", id).select("id").single();
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("case_document_clauses")
          .insert({ ...fields, document_id: doc.id, session_id: doc.session_id, organization_id: doc.organization_id, source: "manual" })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }
      // Xác nhận là lệnh riêng: trigger đưa điều khoản vừa đổi nội dung về nháp.
      if (confirm) {
        const { error } = await supabase.from("case_document_clauses").update({ status: "confirmed" }).eq("id", id!).select("id").single();
        if (error) throw error;
      }
      return { sessionId: doc.session_id, confirm };
    },
    onSuccess: ({ sessionId, confirm }) => {
      invalidate(sessionId);
      toast.success(confirm ? "Đã lưu và xác nhận điều khoản." : "Đã lưu điều khoản (nháp).");
    },
    onError,
  });
}

export function useSetClauseStatus() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: async ({ sessionId, ids, status }: { sessionId: string; ids: string[]; status: ReviewStatus }) => {
      const { error } = await supabase.from("case_document_clauses").update({ status }).in("id", ids);
      if (error) throw error;
      return { sessionId, status, n: ids.length };
    },
    onSuccess: ({ sessionId, status, n }) => {
      invalidate(sessionId);
      toast.success(status === "confirmed" ? `Đã xác nhận ${n} điều khoản.` : "Đã mở lại điều khoản để chỉnh sửa.");
    },
    onError,
  });
}

export function useDeleteCaseClause() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: async ({ sessionId, id }: { sessionId: string; id: string }) => {
      const { data, error } = await supabase.from("case_document_clauses").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Không xoá được điều khoản này.");
      return sessionId;
    },
    onSuccess: (sessionId) => {
      invalidate(sessionId);
      toast.success("Đã xoá điều khoản.");
    },
    onError,
  });
}

export function useSetCaseDocumentReview() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: async ({ doc, status, title }: { doc: CaseDocument; status: ReviewStatus; title?: string }) => {
      const patch = title !== undefined ? { review_status: status, title: title.trim() } : { review_status: status };
      const { error } = await supabase.from("case_documents").update(patch).eq("id", doc.id).select("id").single();
      if (error) throw error;
      return { sessionId: doc.session_id, status };
    },
    onSuccess: ({ sessionId, status }) => {
      invalidate(sessionId);
      toast.success(
        status === "confirmed"
          ? "Đã xác nhận tài liệu — điều khoản được dùng để trả lời người mua."
          : "Đã mở lại tài liệu — điều khoản tạm ngừng được trích dẫn.",
      );
    },
    onError,
  });
}

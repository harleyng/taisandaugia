import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import type { ClauseMap, ContractTemplateType } from "@/lib/contracts/templates/schema";

/**
 * Mẫu hợp đồng có phiên bản (bảng contract_templates). Bất biến: chỉ tạo bản mới
 * hoặc xoá bản CHƯA hiệu lực. RLS: mọi người đăng nhập đọc được (tổ chức / chủ tài
 * sản cần để dựng PDF); ghi cần quyền module `mau-hop-dong`.
 */

export interface ContractTemplate {
  id: string;
  template_type: ContractTemplateType;
  version: string;
  effective_date: string;
  changelog: string | null;
  clauses: ClauseMap;
  created_by: string | null;
  created_at: string;
}

export interface ContractTemplateCreate {
  template_type: ContractTemplateType;
  version: string;
  effective_date: string;
  changelog: string | null;
  clauses: ClauseMap;
}

/** Mọi phiên bản của mọi loại (trang admin), mới nhất trước. */
export function useContractTemplates() {
  return useQuery({
    queryKey: qk.contractTemplates.list,
    queryFn: async (): Promise<ContractTemplate[]> => {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .order("effective_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContractTemplate[];
    },
  });
}

export function useContractTemplate(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.contractTemplates.byId(id),
    enabled: !!id,
    queryFn: async (): Promise<ContractTemplate | null> => {
      const { data, error } = await supabase.from("contract_templates").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as unknown as ContractTemplate | null;
    },
  });
}

/**
 * Bản ĐANG ÁP DỤNG của một loại — do server chọn (active_contract_template, giờ
 * Việt Nam), client không tự so ngày. null khi loại đó chưa có bản nào hiệu lực.
 */
export function useActiveContractTemplate(type: ContractTemplateType | null | undefined) {
  return useQuery({
    queryKey: qk.contractTemplates.active(type),
    enabled: !!type,
    staleTime: 5 * 60_000,
    queryFn: () => fetchActiveContractTemplate(type!),
  });
}

/** Dùng ở chỗ sinh PDF (không phải component) — lỗi mạng ⇒ null để builder dùng mặc định. */
export async function fetchActiveContractTemplate(type: ContractTemplateType): Promise<ContractTemplate | null> {
  const { data, error } = await supabase.rpc("active_contract_template", { _type: type }).maybeSingle();
  if (error) throw error;
  return (data as unknown as ContractTemplate | null) ?? null;
}

/**
 * Mẫu cho chỗ SINH PDF dự thảo: lỗi mạng / chưa có bản ⇒ null, builder dùng hằng
 * số TS từng slot — không chặn việc lập dự thảo vì bảng mẫu tạm không đọc được.
 */
export async function activeTemplateForPdf(
  type: ContractTemplateType,
): Promise<{ version: string; clauses: unknown } | null> {
  try {
    const t = await fetchActiveContractTemplate(type);
    return t ? { version: t.version, clauses: t.clauses } : null;
  } catch {
    return null;
  }
}

export function useCreateContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ContractTemplateCreate): Promise<ContractTemplate> => {
      const { data, error } = await supabase
        .from("contract_templates")
        .insert({ ...payload, version: payload.version.trim() })
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("Mã phiên bản này đã tồn tại cho loại mẫu đã chọn.");
        if (error.code === "42501") {
          throw new Error("Không lưu được: cần quyền tạo mẫu hợp đồng và ngày hiệu lực không được trước hôm nay.");
        }
        throw error;
      }
      return data as unknown as ContractTemplate;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.contractTemplates.all });
      toast.success("Đã tạo phiên bản mẫu hợp đồng");
    },
    onError: (e: Error) => toast.error(e.message || "Không tạo được phiên bản mẫu"),
  });
}

/** Chỉ xoá được bản chưa hiệu lực (RLS). Xoá 0 dòng ⇒ báo lỗi rõ ràng. */
export function useDeleteContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("contract_templates").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Chỉ xoá được phiên bản chưa đến ngày hiệu lực.");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.contractTemplates.all });
      toast.success("Đã xoá phiên bản chờ áp dụng");
    },
    onError: (e: Error) => toast.error(e.message || "Không xoá được phiên bản"),
  });
}

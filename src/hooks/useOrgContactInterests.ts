import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { showContactError, useContactsOrgId, useInvalidateContacts } from "@/hooks/useOrgContacts";
import type { OrgContactInterestFields } from "@/types/org-contacts";

/** Thêm / sửa một dòng nhu cầu. Composite FK (contact_id, organization_id) bảo đảm
 *  không gắn nhầm khách của tổ chức khác. */
export function useSaveContactInterest() {
  const invalidate = useInvalidateContacts();
  const orgId = useContactsOrgId();
  return useMutation({
    mutationFn: async ({ id, contactId, fields }: { id?: string; contactId: string; fields: OrgContactInterestFields }) => {
      if (id) {
        const { error } = await supabase.from("org_contact_interests").update(fields).eq("id", id).select("id").single();
        if (error) throw error;
        return false;
      }
      if (!orgId) throw new Error("Chưa xác định được tổ chức.");
      const { error } = await supabase
        .from("org_contact_interests")
        .insert({ ...fields, contact_id: contactId, organization_id: orgId });
      if (error) throw error;
      return true;
    },
    onSuccess: (created) => {
      invalidate();
      toast.success(created ? "Đã thêm nhu cầu." : "Đã lưu nhu cầu.");
    },
    onError: showContactError,
  });
}

export function useDeleteContactInterest() {
  const invalidate = useInvalidateContacts();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("org_contact_interests").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Không xoá được nhu cầu này.");
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá nhu cầu.");
    },
    onError: showContactError,
  });
}

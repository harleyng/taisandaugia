import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { showContactError, useContactsOrgId, useInvalidateContacts } from "@/hooks/useOrgContacts";
import type { OrgContactGroup, OrgContactGroupFields } from "@/types/org-contacts";

export function useOrgContactGroups() {
  const orgId = useContactsOrgId();
  return useQuery({
    queryKey: qk.orgContactGroups(orgId),
    enabled: !!orgId,
    queryFn: async (): Promise<OrgContactGroup[]> => {
      const { data, error } = await supabase
        .from("org_contact_groups")
        .select("*, org_contact_group_members(count)")
        .eq("organization_id", orgId!)
        .order("name");
      if (error) throw error;
      return (data ?? []).map(({ org_contact_group_members, ...g }) => ({
        ...g,
        member_count: (org_contact_group_members as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
      }));
    },
  });
}

export function useSaveContactGroup() {
  const invalidate = useInvalidateContacts();
  const orgId = useContactsOrgId();
  return useMutation({
    mutationFn: async ({ id, fields }: { id?: string; fields: OrgContactGroupFields }) => {
      if (id) {
        const { error } = await supabase.from("org_contact_groups").update(fields).eq("id", id).select("id").single();
        if (error) throw error;
        return false;
      }
      if (!orgId) throw new Error("Chưa xác định được tổ chức.");
      const { error } = await supabase.from("org_contact_groups").insert({ ...fields, organization_id: orgId });
      if (error) throw error;
      return true;
    },
    onSuccess: (created) => {
      invalidate();
      toast.success(created ? "Đã tạo nhóm." : "Đã lưu nhóm.");
    },
    onError: showContactError,
  });
}

export function useDeleteContactGroup() {
  const invalidate = useInvalidateContacts();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("org_contact_groups").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Không xoá được — vai trò của bạn chưa có quyền xoá nhóm.");
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá nhóm. Khách trong nhóm vẫn giữ nguyên.");
    },
    onError: showContactError,
  });
}

/** Thêm / gỡ MỘT khách khỏi MỘT nhóm. */
export function useToggleGroupMember() {
  const invalidate = useInvalidateContacts();
  const orgId = useContactsOrgId();
  return useMutation({
    mutationFn: async ({ groupId, contactId, member }: { groupId: string; contactId: string; member: boolean }) => {
      if (!orgId) throw new Error("Chưa xác định được tổ chức.");
      if (member) {
        const { error } = await supabase
          .from("org_contact_group_members")
          .insert({ group_id: groupId, contact_id: contactId, organization_id: orgId });
        if (error && error.code !== "23505") throw error;
        return;
      }
      const { error } = await supabase
        .from("org_contact_group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("contact_id", contactId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: showContactError,
  });
}

/** "Lưu thành nhóm" — tạo nhóm mới chứa sẵn một danh sách khách. */
export function useCreateGroupFromContacts() {
  const invalidate = useInvalidateContacts();
  const orgId = useContactsOrgId();
  return useMutation({
    mutationFn: async ({ name, description, contactIds }: { name: string; description: string; contactIds: string[] }) => {
      if (!orgId) throw new Error("Chưa xác định được tổ chức.");
      const { data, error } = await supabase.rpc("org_create_contact_group", {
        _org_id: orgId,
        _name: name,
        _description: description,
        _contact_ids: contactIds,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã lưu danh sách thành nhóm khách hàng.");
    },
    onError: showContactError,
  });
}

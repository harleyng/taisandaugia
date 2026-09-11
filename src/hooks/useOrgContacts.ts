import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useOrg } from "@/contexts/OrgContext";
import { qk } from "@/lib/queryKeys";
import { orgContactErrorMessage } from "@/lib/orgContacts/errors";
import type {
  OrgContact,
  OrgContactFields,
  OrgContactImportResult,
  OrgContactImportRow,
  OrgContactInterest,
  OrgContactListRow,
} from "@/types/org-contacts";

/**
 * Danh bạ khách hàng của tổ chức (/portal/khach-hang).
 *
 * Tổ chức lấy qua OrgContext (theo MEMBERSHIP) như phiên đấu giá — Quản lý /
 * Nhân viên dùng được. Ranh giới thật là RLS module `khach-hang`.
 */
export function useContactsOrgId(): string | null {
  return useOrg().currentOrgId;
}

const CONTACT_SELECT = "*, org_contact_interests(*), org_contact_group_members(group_id)";

type RawContact = OrgContact & {
  org_contact_interests: OrgContactInterest[] | null;
  org_contact_group_members: { group_id: string }[] | null;
};

const toListRow = ({ org_contact_interests, org_contact_group_members, ...c }: RawContact): OrgContactListRow => ({
  ...c,
  org_contact_interests: [...(org_contact_interests ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  group_ids: (org_contact_group_members ?? []).map((m) => m.group_id),
});

export function useOrgContacts() {
  const orgId = useContactsOrgId();
  return useQuery({
    queryKey: qk.orgContacts.byOrg(orgId),
    enabled: !!orgId,
    queryFn: async (): Promise<OrgContactListRow[]> => {
      const { data, error } = await supabase
        .from("org_contacts")
        .select(CONTACT_SELECT)
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as RawContact[]).map(toListRow);
    },
  });
}

export function useOrgContact(id?: string | null) {
  const orgId = useContactsOrgId();
  return useQuery({
    queryKey: qk.orgContacts.byId(orgId, id),
    enabled: !!orgId && !!id,
    queryFn: async (): Promise<OrgContactListRow | null> => {
      const { data, error } = await supabase
        .from("org_contacts")
        .select(CONTACT_SELECT)
        .eq("id", id!)
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data ? toListRow(data as unknown as RawContact) : null;
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Khách, nhu cầu, nhóm đổi ⇒ danh sách, số thành viên nhóm VÀ người nhận của
 *  mọi phiên đều có thể lệch. byOrg là prefix của byId nên phủ luôn chi tiết. */
export function useInvalidateContacts() {
  const queryClient = useQueryClient();
  const orgId = useContactsOrgId();
  return () => {
    queryClient.invalidateQueries({ queryKey: qk.orgContacts.byOrg(orgId) });
    queryClient.invalidateQueries({ queryKey: qk.orgContactGroups(orgId) });
    queryClient.invalidateQueries({ queryKey: qk.sessionAudience.all });
  };
}

export const showContactError = (err: unknown) => toast.error(orgContactErrorMessage(err));

export function useSaveOrgContact() {
  const invalidate = useInvalidateContacts();
  const orgId = useContactsOrgId();
  return useMutation({
    mutationFn: async ({ id, fields }: { id?: string; fields: OrgContactFields }) => {
      if (id) {
        const { error } = await supabase.from("org_contacts").update(fields).eq("id", id).select("id").single();
        if (error) throw error;
        return { id, created: false };
      }
      if (!orgId) throw new Error("Chưa xác định được tổ chức.");
      const { data, error } = await supabase
        .from("org_contacts")
        .insert({ ...fields, organization_id: orgId })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, created: true };
    },
    onSuccess: ({ created }) => {
      invalidate();
      toast.success(created ? "Đã thêm khách hàng." : "Đã lưu thông tin khách hàng.");
    },
    onError: showContactError,
  });
}

type ContactFlags = Partial<Pick<OrgContactFields, "notifications_enabled" | "status">>;

/** Đồng ý nhận tin / ngừng theo dõi — thao tác nhanh từ danh sách. */
export function useUpdateContactFlags() {
  const invalidate = useInvalidateContacts();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ContactFlags }) => {
      const { error } = await supabase.from("org_contacts").update(patch).eq("id", id).select("id").single();
      if (error) throw error;
      return patch;
    },
    onSuccess: (patch) => {
      invalidate();
      if (patch.notifications_enabled !== undefined) {
        toast.success(patch.notifications_enabled ? "Đã ghi nhận khách đồng ý nhận tin." : "Đã ghi nhận khách ngừng nhận tin.");
      } else if (patch.status) {
        toast.success(patch.status === "active" ? "Đã theo dõi lại khách hàng." : "Đã chuyển sang ngừng theo dõi.");
      }
    },
    onError: showContactError,
  });
}

export function useDeleteOrgContact() {
  const invalidate = useInvalidateContacts();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("org_contacts").delete().eq("id", id).select("id");
      if (error) throw error;
      // RLS lọc mất ⇒ 0 dòng, không có lỗi.
      if (!data?.length) throw new Error("Không xoá được — vai trò của bạn chưa có quyền xoá khách hàng.");
      return id;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá khách hàng.");
    },
    onError: showContactError,
  });
}

export function useImportOrgContacts() {
  const invalidate = useInvalidateContacts();
  const orgId = useContactsOrgId();
  return useMutation({
    mutationFn: async (rows: OrgContactImportRow[]): Promise<OrgContactImportResult> => {
      if (!orgId) throw new Error("Chưa xác định được tổ chức.");
      const { data, error } = await supabase.rpc("org_import_contacts", {
        _org_id: orgId,
        _rows: rows as unknown as Json,
      });
      if (error) throw error;
      return data as unknown as OrgContactImportResult;
    },
    onSuccess: () => invalidate(),
    onError: showContactError,
  });
}

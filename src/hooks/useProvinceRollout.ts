/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InviteCsvRow } from "@/lib/provinceRollout/csv";

// Công cụ "Khởi tạo tỉnh" của khu /admin (Phase 9 của
// docs/owner-auction-planning-plan.md). Mọi thao tác đi qua RPC admin_province_*
// (SECURITY DEFINER, cổng `admin_has_permission('goi-thue-bao', …)`): khu admin
// KHÔNG đọc được `asset_owner_workspaces` vì RLS lọc theo thành viên Trạm.
//
// `(supabase as any)`: các RPC này và `admin_units` chưa có trong
// `src/integrations/supabase/types.ts` (máy này không sinh lại được types —
// xem phần Gate của báo cáo Phase 1). Bỏ cast khi types đã sinh lại.
//
// Query key để TẠI ĐÂY, không gom vào `src/lib/queryKeys.ts`: chỗ đọc và chỗ
// invalidate đều nằm trong file này (luật phạm vi ở đầu queryKeys.ts).

const KEY = ["admin-province-rollout"] as const;

export interface ProvinceRow {
  workspace_id: string;
  workspace_name: string;
  admin_unit_code: string;
  province_name: string;
  owner_email: string | null;
  is_demo: boolean;
  branch_count: number;
  member_count: number;
  invite_count: number;
  plan_count: number;
  created_at: string;
}

export interface ProvinceUnitRow {
  branch_id: string;
  display_name: string | null;
  admin_unit_code: string;
  unit_name: string | null;
  unit_type: string | null;
  is_active: boolean;
  member_count: number;
  invite_count: number;
  plan_count: number;
}

export interface ProvinceInviteRow {
  invite_id: string;
  email: string;
  admin_unit_code: string | null;
  unit_name: string | null;
  role: string;
  token: string;
  expires_at: string;
  created_at: string;
}

/** Trạng thái từng dòng mà `admin_province_bulk_invite` trả về. */
export type BulkInviteStatus =
  | "created"
  | "existing"
  | "already_member"
  | "invalid_email"
  | "invalid_role"
  | "unit_not_in_workspace"
  | "role_missing";

export interface BulkInviteResultRow {
  email: string;
  admin_unit_code: string | null;
  unit_name?: string | null;
  role?: string;
  token?: string;
  invite_id?: string;
  status: BulkInviteStatus;
}

export interface BulkInviteResult {
  ok: boolean;
  created: number;
  existing: number;
  failed: number;
  rows: BulkInviteResultRow[];
}

export interface RolloutResult {
  ok: boolean;
  workspace_id: string;
  workspace_created: boolean;
  workspace_name: string;
  province_name: string;
  requested: number;
  branches_created: number;
  branches_total: number;
}

/** Lý do thất bại DỰ KIẾN của các RPC triển khai ⇒ câu tiếng Việt ở UI. */
export const ROLLOUT_REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập lại.",
  forbidden: "Bạn không có quyền khởi tạo tỉnh (cần quyền Tạo của Gói dịch vụ).",
  invalid_province: "Không tìm thấy tỉnh / thành phố này trong danh mục đơn vị hành chính.",
  no_units: "Hãy chọn ít nhất một xã, phường hoặc đặc khu.",
  invalid_unit: "Có mã đơn vị không thuộc tỉnh đã chọn.",
  owner_not_found: "Không tìm thấy tài khoản làm Trưởng đơn vị.",
  not_found: "Không tìm thấy Trạm.",
  workspace_failed: "Không tạo được Trạm cho tỉnh. Vui lòng thử lại.",
  no_rows: "Tệp CSV không có dòng nào dùng được.",
  too_many_rows: "Mỗi lần chỉ mời tối đa 500 dòng.",
};

export const BULK_INVITE_STATUS_LABELS: Record<BulkInviteStatus, string> = {
  created: "Đã tạo lời mời",
  existing: "Đã có lời mời còn hiệu lực",
  already_member: "Đã là thành viên",
  invalid_email: "Email không hợp lệ",
  invalid_role: "Vai trò không hợp lệ",
  unit_not_in_workspace: "Xã chưa có trong Trạm này",
  role_missing: "Trạm thiếu vai trò tương ứng",
};

function assertRolloutOk(data: unknown): void {
  if (data && typeof data === "object" && (data as any).ok === false) {
    const reason = String((data as any).reason ?? "");
    const extra = (data as any).admin_unit_code ? ` (${(data as any).admin_unit_code})` : "";
    throw new Error((ROLLOUT_REASON_MESSAGES[reason] ?? "Không thực hiện được.") + extra);
  }
}

export function useProvinceList() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ProvinceRow[]> => {
      const { data, error } = await (supabase as any).rpc("admin_province_list");
      if (error) throw error;
      return (data ?? []) as ProvinceRow[];
    },
  });
}

export function useProvinceUnits(workspaceId: string | null) {
  return useQuery({
    queryKey: [...KEY, "units", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<ProvinceUnitRow[]> => {
      const { data, error } = await (supabase as any).rpc("admin_province_units", {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      return (data ?? []) as ProvinceUnitRow[];
    },
  });
}

export function useProvinceInvites(workspaceId: string | null) {
  return useQuery({
    queryKey: [...KEY, "invites", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<ProvinceInviteRow[]> => {
      const { data, error } = await (supabase as any).rpc("admin_province_invites", {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      return (data ?? []) as ProvinceInviteRow[];
    },
  });
}

export function useProvinceRollout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      provinceCode: string;
      communeCodes: string[];
      workspaceId?: string | null;
    }): Promise<RolloutResult> => {
      const { data, error } = await (supabase as any).rpc("admin_province_rollout", {
        p_province_code: input.provinceCode,
        p_commune_codes: input.communeCodes,
        p_workspace_id: input.workspaceId ?? null,
      });
      if (error) throw error;
      assertRolloutOk(data);
      return data as RolloutResult;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useBulkInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspaceId: string;
      rows: InviteCsvRow[];
    }): Promise<BulkInviteResult> => {
      const { data, error } = await (supabase as any).rpc("admin_province_bulk_invite", {
        p_workspace_id: input.workspaceId,
        p_rows: input.rows,
      });
      if (error) throw error;
      assertRolloutOk(data);
      return data as BulkInviteResult;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

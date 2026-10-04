import { useCallback, useEffect, useMemo, useRef } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { qk } from "@/lib/queryKeys";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  auditFiltersToRpc,
  auditTargetFromPath,
  parseAuditPage,
  parseAuditScope,
  type AuditAction,
  type AuditEntry,
  type AuditFilterState,
} from "@/lib/ownerAudit";

export const AUDIT_PAGE_SIZE = 50;
/** Trần số dòng của một lần Xuất Excel (RPC giới hạn 5,000). */
export const AUDIT_EXPORT_LIMIT = 5000;

/** Tenant Cá nhân gọi RPC với p_workspace_id = null (types sinh ra kiểu string). */
const wsArg = (workspaceId: string | null) => workspaceId as string;

function rpcError(data: unknown): string | null {
  const r = data as { ok?: boolean; reason?: string } | null;
  return r && r.ok === false ? r.reason ?? "error" : null;
}

/** Tầng xem + danh sách chi nhánh / người cho bộ lọc (RPC owner_audit_scope). */
export function useOwnerAuditScope() {
  const { workspaceId, tenantKey, isLoading } = useOwnerWorkspace();
  return useQuery({
    queryKey: qk.ownerAudit.scope(tenantKey),
    enabled: !isLoading && !!tenantKey,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_audit_scope", { p_workspace_id: wsArg(workspaceId) });
      if (error) throw error;
      const reason = rpcError(data);
      if (reason) throw new Error(reason);
      return parseAuditScope(data);
    },
  });
}

/** Một trang nhật ký theo bộ lọc. `page` bắt đầu từ 0. */
export function useOwnerAuditLog(filters: AuditFilterState, page: number) {
  const { workspaceId, tenantKey, isLoading } = useOwnerWorkspace();
  // Mốc "N ngày qua" chốt lúc bộ lọc đổi — tính lại mỗi lần render sẽ đổi khoá query liên tục.
  const rpcFilters = useMemo(() => auditFiltersToRpc(filters), [filters]);
  return useQuery({
    queryKey: qk.ownerAudit.list(tenantKey, rpcFilters, page),
    enabled: !isLoading && !!tenantKey,
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_audit_list", {
        p_workspace_id: wsArg(workspaceId),
        p_filters: rpcFilters as Json,
        p_limit: AUDIT_PAGE_SIZE,
        p_offset: page * AUDIT_PAGE_SIZE,
      });
      if (error) throw error;
      const reason = rpcError(data);
      if (reason) throw new Error(reason);
      return parseAuditPage(data);
    },
  });
}

/** Mọi dòng theo bộ lọc hiện tại (tối đa AUDIT_EXPORT_LIMIT) — cho Xuất Excel. */
export async function fetchOwnerAuditForExport(
  workspaceId: string | null,
  filters: AuditFilterState,
): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc("owner_audit_list", {
    p_workspace_id: wsArg(workspaceId),
    p_filters: auditFiltersToRpc(filters) as Json,
    p_limit: AUDIT_EXPORT_LIMIT,
    p_offset: 0,
  });
  if (error) throw error;
  const reason = rpcError(data);
  if (reason) throw new Error(reason);
  return parseAuditPage(data).rows;
}

export interface OwnerAuditEvent {
  /** Đăng nhập / đăng xuất do trigger auth.sessions ghi ở server — client không gửi. */
  action: Exclude<AuditAction, "create" | "update" | "delete" | "login" | "logout">;
  /** Đường dẫn trang; mặc định = trang hiện tại. Module / bản ghi suy từ đường dẫn. */
  path?: string;
  /** Tên hiển thị ("Dòng tiền", "Báo cáo Quý 3/2026") — mặc định tiêu đề trang. */
  title?: string;
  meta?: Record<string, unknown>;
}

/**
 * Ghi một lượt xem / xuất / in / chia sẻ vào nhật ký — KHÔNG chờ, không báo lỗi cho
 * người dùng (nhật ký không được chặn thao tác). Server tự tra nhãn bản ghi, kiểm
 * quyền và bỏ lượt xem trùng trong 10 phút.
 */
export function trackOwnerAudit(workspaceId: string | null, event: OwnerAuditEvent) {
  const path = event.path ?? window.location.pathname;
  const target = auditTargetFromPath(path);
  const title = event.title ?? target?.title ?? undefined;
  void supabase
    .rpc("owner_audit_track", {
      p_workspace_id: wsArg(workspaceId),
      p_action: event.action,
      p_module: target?.module ?? undefined,
      p_path: path,
      p_entity_type: target?.entityType ?? undefined,
      p_entity_id: target?.entityId ?? undefined,
      p_meta: { ...(title ? { title } : {}), ...(event.meta ?? {}) } as Json,
    })
    .then(({ error }) => {
      if (error) console.warn("[owner-audit] track failed", error.message);
    });
}

/** Dùng trong trang: `const track = useOwnerAuditTrack(); track({ action: "export", title: "Dòng tiền" })`. */
export function useOwnerAuditTrack() {
  const { workspaceId, isLoading } = useOwnerWorkspace();
  /** false = tenant chưa tải xong, chưa ghi (gọi lại sau). */
  return useCallback(
    (event: OwnerAuditEvent): boolean => {
      if (isLoading) return false;
      trackOwnerAudit(workspaceId, event);
      return true;
    },
    [workspaceId, isLoading],
  );
}

/**
 * Gắn ở OwnerPortalLayout: ghi một lượt xem mỗi khi đổi trang trong cổng (server bỏ
 * trùng trong 10 phút). Đăng nhập / đăng xuất ghi ở server (trigger auth.sessions).
 */
export function useOwnerPageViewTracker() {
  const { pathname } = useLocation();
  const { workspaceId, tenantKey, isLoading } = useOwnerWorkspace();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !tenantKey) return;
    const key = `${tenantKey}|${pathname}`;
    if (last.current === key) return;
    last.current = key;
    trackOwnerAudit(workspaceId, { action: "view", path: pathname });
  }, [pathname, tenantKey, workspaceId, isLoading]);
}

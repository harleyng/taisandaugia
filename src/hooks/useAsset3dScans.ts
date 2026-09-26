// Model 3D của hồ sơ số hoá: đọc phiên quét, bắt đầu quét (trừ credit ở server),
// đối tác giả lập giao kết quả, admin duyệt model về muộn, và model công khai của lô.
//
// Mọi GHI đi qua RPC — bảng asset_3d_scans không có policy ghi. RPC trả
// `{ok:false, reason}` cho lỗi nghiệp vụ nên phải kiểm `ok` trước khi báo thành công.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import type { Asset3dScan, Lot3dModel, StartedScan } from "@/types/asset3d";

const REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_found: "Không tìm thấy hồ sơ tài sản.",
  scan_not_found: "Không tìm thấy phiên quét, hoặc liên kết quét không hợp lệ.",
  posting_closed: "Hồ sơ đã kết thúc — không thêm model 3D được nữa.",
  service_unavailable: "Dịch vụ quét 3D đang tạm ngưng. Vui lòng thử lại sau.",
  insufficient: "Số dư credit không đủ để quét 3D.",
  lot_mismatch: "Kết quả quét không thuộc hồ sơ này nên không được gắn.",
  job_mismatch: "Kết quả quét không khớp phiên quét.",
  job_conflict: "Kết quả quét đã được gắn cho một phiên khác.",
  invalid_status: "Phiên quét đã kết thúc — không nhận thêm kết quả.",
  posting_not_approved: "Hồ sơ chưa được duyệt nên chưa công khai model được.",
  not_authorized: "Bạn không có quyền duyệt tài sản.",
};

export class Asset3dRpcError extends Error {
  readonly reason: string;
  readonly payload: Record<string, unknown>;
  constructor(reason: string, payload: Record<string, unknown>) {
    super(REASON_MESSAGES[reason] ?? "Thao tác không thành công. Vui lòng thử lại.");
    this.reason = reason;
    this.payload = payload;
  }
}

function unwrap(data: unknown): Record<string, unknown> {
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true) throw new Asset3dRpcError(String(payload.reason ?? ""), payload);
  return payload;
}

const IN_FLIGHT = new Set(["awaiting_scan", "processing"]);

/** Phiên quét đang chạy + model hiện hành (ready) + lần thử gần nhất của một hồ sơ. */
export function summarizeScans(scans: Asset3dScan[]) {
  return {
    inFlight: scans.find((s) => IN_FLIGHT.has(s.status)) ?? null,
    current: scans.find((s) => s.status === "ready") ?? null,
    latest: scans[0] ?? null,
  };
}

/**
 * Các phiên quét của một hồ sơ, mới nhất trước. Chủ tài sản đọc qua RLS own-rows,
 * admin qua quyền xem tai-san-tu-nguyen. Khi còn phiên đang chạy thì hỏi lại mỗi
 * 15 giây — webhook đối tác đổi trạng thái ở server, client không được báo.
 */
export function usePostingScans(postingId: string | null | undefined) {
  return useQuery({
    queryKey: qk.asset3d.byPosting(postingId),
    enabled: !!postingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_3d_scans")
        .select("*")
        .eq("asset_posting_id", postingId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Asset3dScan[];
    },
    refetchInterval: (query) =>
      (query.state.data ?? []).some((s) => IN_FLIGHT.has(s.status)) ? 15_000 : false,
  });
}

/**
 * Tập id hồ sơ đang có model 3D hiện hành — cho nhãn "3D" ở danh sách. Không lọc
 * theo id: RLS đã giới hạn (chủ tài sản chỉ thấy của mình, admin thấy tất cả), và
 * `.in()` với hàng trăm uuid làm URL PostgREST dài quá giới hạn.
 */
export function useReady3dPostingIds() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.asset3d.readyIds(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_3d_scans")
        .select("asset_posting_id")
        .eq("status", "ready");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.asset_posting_id));
    },
  });
}

/** Bắt đầu phiên quét: server trừ credit atomic; đang có phiên chạy thì trả lại phiên đó. */
export function useStartScan() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postingId }: { postingId: string }): Promise<StartedScan> => {
      const { data, error } = await supabase.rpc("start_asset_3d_scan", { _posting_id: postingId });
      if (error) throw error;
      const p = unwrap(data);
      return {
        scanId: String(p.scan_id),
        scanToken: String(p.scan_token),
        lotId: String(p.lot_id),
        reused: p.reused === true,
        cost: Number(p.cost ?? 0),
      };
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.asset3d.byPosting(vars.postingId) });
      queryClient.invalidateQueries({ queryKey: qk.userCredits.byUser(userId) });
    },
  });
}

/** Đối tác GIẢ LẬP giao kết quả — cùng hàm SQL mà webhook thật gọi. */
export function useMockPartnerDeliver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      scanId: string;
      lotId: string;
      token: string;
      outcome: "processing" | "ready" | "failed";
    }) => {
      const { data, error } = await supabase.rpc("mock_partner_deliver_asset_3d_scan", {
        _scan_id: args.scanId,
        _lot_id: args.lotId,
        _token: args.token,
        _outcome: args.outcome,
      });
      if (error) throw error;
      return unwrap(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.asset3d.all });
      queryClient.invalidateQueries({ queryKey: qk.userCredits.all });
    },
  });
}

/** Admin công khai model về SAU khi hồ sơ đã được duyệt. */
export function useAdminPublish3dModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scanId }: { scanId: string; postingId: string }) => {
      const { data, error } = await supabase.rpc("admin_publish_asset_3d_model", { _scan_id: scanId });
      if (error) throw error;
      unwrap(data);
    },
    onSuccess: () => toast.success("Đã duyệt model 3D — model đang hiển thị công khai."),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Không duyệt được model 3D."),
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.asset3d.byPosting(vars.postingId) });
    },
  });
}

/** Model 3D đã công khai của các lô trong một phiên (map item_id → model). */
export function useSessionLot3dModels(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: qk.asset3d.sessionLots(sessionId),
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_session_lot_3d_models", { _session_id: sessionId! });
      if (error) throw error;
      return new Map((data ?? []).map((m) => [m.item_id, m as Lot3dModel]));
    },
  });
}

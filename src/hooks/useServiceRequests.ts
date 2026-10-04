import { useMemo } from "react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useAdminLegalConsultations } from "@/hooks/useAdminLegalConsultations";
import { useAdminAuctionConsultations } from "@/hooks/useAdminAuctionConsultations";
import { useAdminAuthenticationOrders } from "@/hooks/useAdminAuthenticationOrders";
import { useAdminValuationOrders } from "@/hooks/useAdminValuationOrders";
import { useAdminVrTourOrders } from "@/hooks/useAdminVrTourOrders";
import { useAdminMarketingOrders } from "@/hooks/useAdminMarketingOrders";
import { matrixHas } from "@/lib/adminPermissions";
import { SERVICE_KINDS, type ServiceKind, type ServiceRequestKindKey } from "@/lib/serviceRequests/kinds";
import {
  fromAuctionConsult,
  fromAuthentication,
  fromLegalConsult,
  fromMarketingOrder,
  fromValuation,
  fromVrTour,
  type ServiceRequestRow,
} from "@/lib/serviceRequests/normalize";

/**
 * Danh sách gộp "Yêu cầu dịch vụ": đọc 6 bảng bằng 6 query sẵn có rồi chuẩn hoá ở client.
 * Mỗi query chỉ chạy khi admin có quyền xem module của loại đó — RLS vẫn là cổng thật
 * (VR/giám định còn mở cho tai-san-tu-nguyen:view, nhưng menu này bám mã module dịch vụ).
 */
export function useServiceRequests() {
  const { isSuperAdmin, matrix, ready } = useAdminPermissions();
  const can = (kind: ServiceRequestKindKey) =>
    ready && (isSuperAdmin || matrixHas(matrix, SERVICE_KINDS.find((k) => k.key === kind)!.module, "view"));

  const legal = useAdminLegalConsultations(can("tu-van-phap-ly"));
  const auction = useAdminAuctionConsultations(can("tu-van-dau-gia"));
  const valuation = useAdminValuationOrders(can("tham-dinh"));
  const authentication = useAdminAuthenticationOrders(can("giam-dinh"));
  const vr = useAdminVrTourOrders(can("vr-tour"));
  const mkt = useAdminMarketingOrders(can("truyen-thong"));

  const kinds: ServiceKind[] = SERVICE_KINDS.filter((k) => can(k.key));
  // Khoá theo loại (không theo chỉ số) ⇒ thêm loại mới không lệch thứ tự với SERVICE_KINDS.
  const queries: Record<ServiceRequestKindKey, { isError: boolean; isLoading: boolean; isFetching: boolean; refetch: () => unknown }> = {
    "tu-van-phap-ly": legal,
    "tu-van-dau-gia": auction,
    "tham-dinh": valuation,
    "giam-dinh": authentication,
    "vr-tour": vr,
    "truyen-thong": mkt,
  };
  const all = Object.values(queries);

  const rows = useMemo<ServiceRequestRow[]>(() => {
    const now = Date.now();
    return [
      ...(legal.data ?? []).map((r) => fromLegalConsult(r, now)),
      ...(auction.data ?? []).map((r) => fromAuctionConsult(r, now)),
      ...(valuation.data ?? []).map((r) => fromValuation(r, now)),
      ...(authentication.data ?? []).map((r) => fromAuthentication(r, now)),
      ...(vr.data ?? []).map((r) => fromVrTour(r, now)),
      ...(mkt.data ?? []).map((r) => fromMarketingOrder(r, now)),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [legal.data, auction.data, valuation.data, authentication.data, vr.data, mkt.data]);

  const failedKinds = SERVICE_KINDS.filter((k) => queries[k.key].isError).map((k) => k.label);

  return {
    kinds,
    rows,
    ready,
    isLoading: !ready || all.some((q) => q.isLoading),
    isFetching: all.some((q) => q.isFetching),
    failedKinds,
    // refetch() bỏ qua `enabled` ⇒ chỉ gọi lại loại được phép xem.
    refetch: () => SERVICE_KINDS.forEach((k) => can(k.key) && queries[k.key].refetch()),
  };
}

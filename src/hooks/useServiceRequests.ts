import { useMemo } from "react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useAdminLegalConsultations } from "@/hooks/useAdminLegalConsultations";
import { useAdminAuctionConsultations } from "@/hooks/useAdminAuctionConsultations";
import { useAdminAuthenticationOrders } from "@/hooks/useAdminAuthenticationOrders";
import { useAdminVrTourOrders } from "@/hooks/useAdminVrTourOrders";
import { matrixHas } from "@/lib/adminPermissions";
import { SERVICE_KINDS, type ServiceKind, type ServiceKindKey } from "@/lib/serviceRequests/kinds";
import {
  fromAuctionConsult,
  fromAuthentication,
  fromLegalConsult,
  fromVrTour,
  type ServiceRequestRow,
} from "@/lib/serviceRequests/normalize";

/**
 * Danh sách gộp "Yêu cầu dịch vụ": đọc 4 bảng bằng 4 query sẵn có rồi chuẩn hoá ở client.
 * Mỗi query chỉ chạy khi admin có quyền xem module của loại đó — RLS vẫn là cổng thật
 * (VR/giám định còn mở cho tai-san-tu-nguyen:view, nhưng menu này bám mã module dịch vụ).
 */
export function useServiceRequests() {
  const { isSuperAdmin, matrix, ready } = useAdminPermissions();
  const can = (kind: ServiceKindKey) =>
    ready && (isSuperAdmin || matrixHas(matrix, SERVICE_KINDS.find((k) => k.key === kind)!.module, "view"));

  const legal = useAdminLegalConsultations(can("tu-van-phap-ly"));
  const auction = useAdminAuctionConsultations(can("tu-van-dau-gia"));
  const authentication = useAdminAuthenticationOrders(can("giam-dinh"));
  const vr = useAdminVrTourOrders(can("vr-tour"));

  const kinds: ServiceKind[] = SERVICE_KINDS.filter((k) => can(k.key));
  const queries = [legal, auction, authentication, vr];

  const rows = useMemo<ServiceRequestRow[]>(() => {
    const now = Date.now();
    return [
      ...(legal.data ?? []).map((r) => fromLegalConsult(r, now)),
      ...(auction.data ?? []).map((r) => fromAuctionConsult(r, now)),
      ...(authentication.data ?? []).map((r) => fromAuthentication(r, now)),
      ...(vr.data ?? []).map((r) => fromVrTour(r, now)),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [legal.data, auction.data, authentication.data, vr.data]);

  const failedKinds = SERVICE_KINDS.filter((_, i) => queries[i].isError).map((k) => k.label);

  return {
    kinds,
    rows,
    ready,
    isLoading: !ready || queries.some((q) => q.isLoading),
    isFetching: queries.some((q) => q.isFetching),
    failedKinds,
    // refetch() bỏ qua `enabled` ⇒ chỉ gọi lại loại được phép xem.
    refetch: () => SERVICE_KINDS.forEach((k, i) => can(k.key) && queries[i].refetch()),
  };
}

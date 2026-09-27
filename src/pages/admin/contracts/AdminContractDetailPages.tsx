import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminConsignmentContractView } from "@/components/admin/contracts/AdminConsignmentContractView";
import { ServiceContractDetailBody } from "@/components/service-contracts/ServiceContractDetailBody";
import { useAdminConsignmentContract } from "@/hooks/useAdminContracts";
import { useServiceContractDetail } from "@/hooks/useServiceContracts";
import { ADMIN_CONTRACTS_PATH } from "@/lib/contracts/paths";
import { serviceRequestDetailPath } from "@/lib/serviceRequests/kinds";
import SaleContractPage from "@/pages/SaleContractPage";

/** Khung chung: nút về danh sách (giữ tab loại) + trạng thái tải / không thấy. */
function Frame({
  tab,
  isLoading,
  notFound,
  children,
}: {
  tab: "ky-gui" | "mua-ban" | "dich-vu";
  isLoading?: boolean;
  notFound?: boolean;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const back = `${ADMIN_CONTRACTS_PATH}?loai=${tab}`;
  return (
    <div className="space-y-4 px-6 py-8">
      <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(back)}>
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
        Hợp đồng
      </Button>
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>
      ) : notFound ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          Không tìm thấy hợp đồng, hoặc bạn không có quyền xem.
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** /admin/hop-dong/ky-gui/:id */
export function AdminConsignmentContractPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useAdminConsignmentContract(id);
  return (
    <Frame tab="ky-gui" isLoading={isLoading} notFound={!!error || !data}>
      {data && <AdminConsignmentContractView contract={data.contract} events={data.events} />}
    </Frame>
  );
}

/** /admin/hop-dong/mua-ban/:id — dùng CHUNG trang với các bên; admin không có can_act ⇒ chỉ đọc. */
export function AdminSaleContractPage() {
  return (
    <div className="px-6 py-8">
      <SaleContractPage embedded backPath={`${ADMIN_CONTRACTS_PATH}?loai=mua-ban`} backLabel="Về danh sách hợp đồng" />
    </div>
  );
}

/** /admin/hop-dong/dich-vu/:id */
export function AdminServiceContractPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useServiceContractDetail(id);
  return (
    <Frame tab="dich-vu" isLoading={isLoading} notFound={!!error || !data}>
      {data && (
        <ServiceContractDetailBody
          detail={data}
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(serviceRequestDetailPath(data.contract.service_kind, data.contract.order_id))}
            >
              Mở đơn dịch vụ
            </Button>
          }
        />
      )}
    </Frame>
  );
}

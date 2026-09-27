import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ServiceContractDetailBody } from "@/components/service-contracts/ServiceContractDetailBody";
import { useServiceContractDetail } from "@/hooks/useServiceContracts";
import { ownerContractsPath } from "@/lib/contracts/paths";
import { serviceOrderOwnerPath } from "@/lib/serviceContracts";

/** /chu-tai-san/hop-dong/dich-vu/:id — hợp đồng cung ứng dịch vụ đã giao kết (chỉ đọc). */
export default function OwnerServiceContractPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useServiceContractDetail(id);

  const back = (
    <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(ownerContractsPath("dich-vu"))}>
      <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
      Hợp đồng
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState
            icon={FileSignature}
            title="Không tìm thấy hợp đồng"
            description="Hợp đồng không tồn tại hoặc bạn không có quyền xem."
          />
        </div>
      </div>
    );
  }

  const c = data.contract;
  return (
    <div className="space-y-2">
      {back}
      <ServiceContractDetailBody
        detail={data}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(serviceOrderOwnerPath(c.service_kind, c.asset_posting_id))}
          >
            Xem đơn dịch vụ
          </Button>
        }
      />
    </div>
  );
}

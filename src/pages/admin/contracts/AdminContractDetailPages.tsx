import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Radio } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuctionLink } from "@/components/shared/AuctionLink";
import { AdminConsignmentContractView } from "@/components/admin/contracts/AdminConsignmentContractView";
import { ServiceContractDetailBody } from "@/components/service-contracts/ServiceContractDetailBody";
import { useAdminConsignmentContract } from "@/hooks/useAdminContracts";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useSaleContractDetail } from "@/hooks/useSaleContracts";
import { AUCTION_LINKS } from "@/lib/auctionPlatform";
import type { SaleAssetSnapshot } from "@/types/auction-sale-contract";
import { cn } from "@/lib/utils";
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

/**
 * Phiên sinh ra hợp đồng: giám sát trong admin + trang phiên trên sàn (Phase 6.1). Đọc
 * cùng query với SaleContractPage (cache chung) ⇒ không sửa trang dùng chung với sàn.
 */
function SaleContractSessionBar({ contractId }: { contractId: string | undefined }) {
  const navigate = useNavigate();
  const canMonitor = useHasAdminPermission("phien-dau-gia");
  const { data } = useSaleContractDetail(contractId ?? null);
  const sessionId = data?.contract.session_id;
  if (!sessionId) return null;
  const code = ((data.contract.asset_snapshot ?? {}) as SaleAssetSnapshot).session_code;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
      <span className="mr-auto text-muted-foreground">
        Phiên đấu giá <span className="font-mono font-semibold text-foreground">{code ?? "—"}</span>
      </span>
      {canMonitor && (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(`/admin/phien-dau-gia/${sessionId}`)}>
          <Radio className="h-3.5 w-3.5" aria-hidden />
          Giám sát phiên
        </Button>
      )}
      <AuctionLink
        to={AUCTION_LINKS.session(sessionId)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
      >
        Trang phiên trên sàn
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </AuctionLink>
    </div>
  );
}

/** /admin/hop-dong/mua-ban/:id — dùng CHUNG trang với các bên; admin không có can_act ⇒ chỉ đọc. */
export function AdminSaleContractPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="px-6 py-8">
      <SaleContractSessionBar contractId={id} />
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

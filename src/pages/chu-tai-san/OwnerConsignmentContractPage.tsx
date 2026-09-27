import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerContractPanel } from "@/components/asset-posting/OwnerContractPanel";
import { NO_POSTING_ACCESS, PostingAccessProvider } from "@/components/asset-posting/postingAccess";
import { useOwnerConsignmentContract } from "@/hooks/useOwnerContracts";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { ownerContractsPath } from "@/lib/contracts/paths";
import { ownerConsignmentPath } from "@/lib/consignment/ownerConsignment";

/**
 * /chu-tai-san/hop-dong/ky-gui/:id — hợp đồng dịch vụ đấu giá với tổ chức đã chốt.
 *
 * Mọi thao tác phía chủ tài sản (xác nhận bản ký, tải bản ký, huỷ, bổ sung địa chỉ)
 * nằm ở OwnerContractPanel — cùng component trước đây ở trang Ký gửi. Quyền ghi
 * (ẩn nút) theo hồ sơ của hợp đồng; RLS + RPC mới là cổng thật.
 */
export default function OwnerConsignmentContractPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useOwnerConsignmentContract(id);
  const { postingAccess } = useOwnerWorkspace();

  const back = (
    <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(ownerContractsPath("ky-gui"))}>
      <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
      Hợp đồng
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-80 w-full rounded-2xl" />
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
            description="Hợp đồng không tồn tại hoặc bạn không có quyền xem trong không gian đang chọn."
          />
        </div>
      </div>
    );
  }

  const { contract, posting, org } = data;
  const title = contract.asset_snapshot?.title ?? posting?.title ?? "Tài sản";

  return (
    <div className="space-y-6">
      <div>
        {back}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Hợp đồng ký gửi {contract.code ?? ""}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {[title, org?.name].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(ownerConsignmentPath(contract.asset_posting_id))}>
            Xem hồ sơ ký gửi
          </Button>
        </div>
      </div>

      <PostingAccessProvider value={posting ? postingAccess(posting) : NO_POSTING_ACCESS}>
        <OwnerContractPanel
          contract={contract}
          org={org}
          postingId={contract.asset_posting_id}
          startingPrice={posting?.starting_price ?? null}
        />
      </PostingAccessProvider>
    </div>
  );
}

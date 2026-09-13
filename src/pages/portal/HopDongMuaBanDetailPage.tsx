import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SaleContractBody } from "@/components/sale-contracts/SaleContractBody";
import { SaleStageBadge } from "@/components/sale-contracts/SaleStageBadge";
import { useSaleContractDetail } from "@/hooks/useSaleContracts";
import { PORTAL_SALE_CONTRACTS_PATH } from "@/lib/saleContracts/files";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import type { SaleAssetSnapshot } from "@/types/auction-sale-contract";

const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((ch) => [ch.slug, ch.name])),
);

/**
 * /portal/hop-dong-mua-ban/:id
 *
 * Quyền thao tác lấy từ `can_act` của RPC, KHÔNG từ OrgSwitcher: hợp đồng mở
 * bằng đường link có thể thuộc tổ chức khác với tổ chức đang chọn, và server
 * mới là nơi quyết định.
 */
export default function HopDongMuaBanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useSaleContractDetail(id ?? null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-20 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Đang tải hợp đồng…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 py-6">
        <Card className="rounded-2xl p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Không tìm thấy hợp đồng này, hoặc bạn không có quyền xem.
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => navigate(PORTAL_SALE_CONTRACTS_PATH)}>
            Về danh sách hợp đồng
          </Button>
        </Card>
      </div>
    );
  }

  const asset = (data.contract.asset_snapshot ?? {}) as SaleAssetSnapshot;

  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => navigate(PORTAL_SALE_CONTRACTS_PATH)}
        >
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          Hợp đồng mua bán
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{data.contract.code}</h1>
          <SaleStageBadge stage={data.stage} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[asset.title, asset.session_code ? `Phiên ${asset.session_code}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <SaleContractBody
        detail={data}
        categoryLabel={asset.category_slug ? (CHILD_LABEL[asset.category_slug] ?? null) : null}
      />
    </div>
  );
}

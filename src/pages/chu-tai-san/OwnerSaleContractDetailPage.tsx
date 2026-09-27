import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SaleContractBody } from "@/components/sale-contracts/SaleContractBody";
import { OwnerSaleContractHero } from "@/components/owner-portal/sale-contracts/OwnerSaleContractHero";
import { useSaleContractDetail } from "@/hooks/useSaleContracts";
import { OWNER_SALE_CONTRACTS_PATH } from "@/lib/saleContracts/files";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import type { SaleAssetSnapshot } from "@/types/auction-sale-contract";

const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((ch) => [ch.slug, ch.name])),
);

/**
 * /chu-tai-san/hop-dong-mua-ban/:id — chi tiết hợp đồng trong cổng chủ tài sản.
 *
 * Cùng RPC + thân trang với bên mua và tổ chức (vai suy từ `can_act`), chỉ khác
 * bố cục: hero trên cùng, rồi `split` — thẻ thao tác bên trái, tóm tắt / tài sản /
 * các bên bên phải.
 */
export default function OwnerSaleContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useSaleContractDetail(id ?? null);
  const back = () => navigate(OWNER_SALE_CONTRACTS_PATH);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Đang tải hợp đồng…
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="mx-auto mt-10 max-w-xl rounded-2xl p-10 text-center">
        <p className="text-sm text-muted-foreground">Không tìm thấy hợp đồng này, hoặc bạn không có quyền xem.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={back}>
          Về danh sách hợp đồng
        </Button>
      </Card>
    );
  }

  const asset = (data.contract.asset_snapshot ?? {}) as SaleAssetSnapshot;

  return (
    <div className="space-y-5">
      <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={back}>
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
        Hợp đồng mua bán
      </Button>

      <OwnerSaleContractHero detail={data} />

      <SaleContractBody
        detail={data}
        layout="split"
        categoryLabel={asset.category_slug ? (CHILD_LABEL[asset.category_slug] ?? null) : null}
      />
    </div>
  );
}

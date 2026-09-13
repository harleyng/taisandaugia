import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SaleContractBody } from "@/components/sale-contracts/SaleContractBody";
import { SaleStageBadge } from "@/components/sale-contracts/SaleStageBadge";
import { useSaleContractDetail } from "@/hooks/useSaleContracts";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import type { SaleAssetSnapshot } from "@/types/auction-sale-contract";

const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((ch) => [ch.slug, ch.name])),
);

/**
 * /hop-dong-mua-ban/:id — trang hợp đồng cho NGƯỜI TRÚNG ĐẤU GIÁ và cho CHỦ
 * TÀI SẢN (khi mở từ cổng chủ tài sản; cùng route, RLS quyết ai thấy gì).
 *
 * Dùng chung `SaleContractBody` với cổng tổ chức — vai của người xem suy từ
 * `can_act`, nên không có nhánh giao diện riêng cho từng bên.
 */
export default function SaleContractPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useSaleContractDetail(id ?? null);

  if (isLoading) {
    return (
      <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-24 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Đang tải hợp đồng…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16">
        <Card className="rounded-2xl p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Không tìm thấy hợp đồng này, hoặc bạn không có quyền xem.
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => navigate("/profile?tab=auction-contracts")}>
            Về hồ sơ đấu giá của tôi
          </Button>
        </Card>
      </div>
    );
  }

  const asset = (data.contract.asset_snapshot ?? {}) as SaleAssetSnapshot;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
        Quay lại
      </Button>

      <div className="mb-6 mt-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Hợp đồng mua bán {data.contract.code}</h1>
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

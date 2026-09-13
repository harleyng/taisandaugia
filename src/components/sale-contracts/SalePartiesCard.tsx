import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SALE_SELLER_KIND_LABELS, type SaleContract } from "@/types/auction-sale-contract";
import type {
  SaleBuyerParty,
  SaleOrgParty,
  SaleSellerParty,
} from "@/types/auction-sale-contract";

const DASH = "—";
const val = (v?: string | number | null) =>
  v === null || v === undefined || String(v).trim() === "" ? DASH : String(v);
const joinAddr = (...p: Array<string | null | undefined>) => p.filter((x) => x && x.trim()).join(", ");

function Rows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap gap-x-2">
          <dt className="min-w-[7.5rem] text-muted-foreground">{k}</dt>
          <dd className="flex-1 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Hai bên của hợp đồng. Cả hai đều thấy CCCD của nhau — đó là bản chất một hợp
 * đồng giữa họ, và đúng bằng thứ tổ chức đã thấy ở hồ sơ tham gia đấu giá.
 */
export function SalePartiesCard({ contract }: { contract: SaleContract }) {
  const buyer = (contract.buyer_party ?? {}) as SaleBuyerParty;
  const seller = (contract.seller_party ?? {}) as SaleSellerParty;
  const org = (contract.org_party ?? {}) as SaleOrgParty;
  const registry = contract.seller_kind === "org_on_behalf";

  const sellerRows: Array<[string, string]> = registry
    ? [
        ["Tên", val(seller.name ?? seller.org_name ?? seller.full_name)],
        ["Địa chỉ", val(seller.address)],
      ]
    : seller.kind === "organization"
      ? [
          ["Tên tổ chức", val(seller.org_name ?? seller.name)],
          ["Mã số thuế", val(seller.tax_code)],
          ["Địa chỉ", val(joinAddr(seller.address, seller.province))],
          ["Người đại diện", val(seller.rep_full_name)],
        ]
      : [
          ["Họ và tên", val(seller.full_name ?? seller.name)],
          [seller.id_type === "passport" ? "Hộ chiếu" : "CCCD", val(seller.id_number)],
          ["Địa chỉ", val(joinAddr(seller.address, seller.ward, seller.province))],
          ["Điện thoại", val(seller.phone)],
        ];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Các bên của hợp đồng</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">Bên bán</h3>
            <Badge variant="outline" className="text-xs font-normal">
              {SALE_SELLER_KIND_LABELS[contract.seller_kind]}
            </Badge>
          </div>
          <Rows rows={sellerRows} />
          {registry ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Chủ tài sản không có tài khoản trên sàn. Tổ chức đấu giá thực hiện việc ký kết và các
              thủ tục liên quan thay mặt bên bán.
            </p>
          ) : null}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Bên mua (người trúng đấu giá)</h3>
          <Rows
            rows={[
              ["Họ và tên", val(buyer.full_name)],
              [buyer.id_type === "passport" ? "Hộ chiếu" : "CCCD", val(buyer.id_number)],
              ["Địa chỉ", val(buyer.address)],
              ["Điện thoại", val(buyer.phone)],
              ["Số báo danh", val(buyer.bidder_no)],
            ]}
          />
        </section>

        {contract.org_signs ? (
          <section className="md:col-span-2">
            <h3 className="mb-2 text-sm font-semibold">Tổ chức đấu giá (bên ký thứ ba)</h3>
            <Rows
              rows={[
                ["Tên tổ chức", val(org.name)],
                ["Người đại diện", val(org.legal_rep_name)],
                ["Chức vụ", val(org.legal_rep_position)],
              ]}
            />
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

import { useNavigate } from "react-router-dom";
import { ExternalLink, MapPin, Package, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHILD_NAME, PARENT_NAME } from "@/constants/category.constants";
import { formatVnd } from "@/lib/advertising/slug";
import type { AuctionSessionItem } from "@/types/auction-session";

const categoryName = (slug: string | null) => (slug ? (CHILD_NAME[slug] ?? PARENT_NAME[slug] ?? null) : null);
const money = (v: number | null) => (v != null ? formatVnd(v) : "—");

/** Danh sách lô tài sản của một phiên — đọc SNAPSHOT, không JOIN sang nguồn. */
export function SessionLotList({ lots }: { lots: AuctionSessionItem[] }) {
  const navigate = useNavigate();

  if (lots.length === 0) {
    return (
      <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">Phiên chưa có tài sản.</Card>
    );
  }

  return (
    <div className="space-y-3">
      {lots.map((lot) => {
        const location = [lot.district, lot.province].filter(Boolean).join(", ");
        const category = categoryName(lot.category_slug);
        return (
          <Card key={lot.id} className="flex flex-col gap-4 rounded-2xl p-4 sm:flex-row">
            <div className="h-36 w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-40">
              {lot.image_url ? (
                <img src={lot.image_url} alt={lot.title} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Package className="h-8 w-8" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Lô {lot.lot_no}</Badge>
                {category && <span className="text-xs text-muted-foreground">{category}</span>}
              </div>
              <p className="font-semibold text-foreground">{lot.title}</p>
              {location && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {location}
                </p>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Giá khởi điểm</dt>
                  <dd className="font-semibold text-primary">{money(lot.starting_price)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Tiền đặt trước</dt>
                  <dd className="font-medium text-foreground">{money(lot.deposit_amount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Bước giá</dt>
                  <dd className="font-medium text-foreground">{money(lot.bid_step)}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {lot.max_registrants != null && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Tối đa {lot.max_registrants} người đăng ký
                  </span>
                )}
                {lot.source === "listing" && lot.listing_id && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => navigate(`/auctions/${lot.listing_id}`)}
                  >
                    Xem chi tiết tài sản
                    <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

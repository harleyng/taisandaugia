import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, ExternalLink, FileText, MapPin, Package, Rotate3d, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHILD_NAME, PARENT_NAME } from "@/constants/category.constants";
import { formatVnd } from "@/lib/advertising/slug";
import { Lot3dDialog, type LotMediaTab } from "@/components/asset-3d/Lot3dDialog";
import { Model3dBadge } from "@/components/asset-3d/Model3dBadge";
import { VrTourBadge } from "@/components/vr-tour/VrTourBadge";
import { AuthenticatedBadge } from "@/components/authentication/AuthenticatedBadge";
import { VerificationLevelChip } from "@/components/authentication/VerificationLevelChip";
import { openCertificate } from "@/hooks/useAuthenticationOrders";
import type { AuctionSessionItem } from "@/types/auction-session";
import type { Lot3dModel } from "@/types/asset3d";
import type { LotVrTour } from "@/types/vrTour";
import type { LotAuthentication } from "@/types/authentication";

const categoryName = (slug: string | null) => (slug ? (CHILD_NAME[slug] ?? PARENT_NAME[slug] ?? null) : null);
const money = (v: number | null) => (v != null ? formatVnd(v) : "—");

/**
 * Danh sách lô tài sản của một phiên — đọc SNAPSHOT, không JOIN sang nguồn.
 * `models` (item_id → model 3D đã công khai) thêm nhãn "3D" + nút xem (BR-3D-03).
 * `vrTours` (item_id → VR tour đã gắn lô) thêm nhãn "VR" + nút xem (BR-VR-04).
 * `authentications` (item_id → chứng thư "xác thực" đã công khai) thêm huy hiệu "Đã giám định",
 * mức xác minh và nút xem chứng thư. Kết luận tiêu cực không bao giờ tới đây (RPC chỉ trả xác thực).
 */
export function SessionLotList({
  lots,
  models,
  vrTours,
  authentications,
}: {
  lots: AuctionSessionItem[];
  models?: Map<string, Lot3dModel>;
  vrTours?: Map<string, LotVrTour>;
  authentications?: Map<string, LotAuthentication>;
}) {
  const navigate = useNavigate();
  const [viewing, setViewing] = useState<{ lot: AuctionSessionItem; tab: LotMediaTab } | null>(null);
  const viewingModel = viewing ? models?.get(viewing.lot.id) : undefined;
  const viewingVr = viewing ? vrTours?.get(viewing.lot.id) : undefined;

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
        const cert = authentications?.get(lot.id);
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
                {models?.has(lot.id) && <Model3dBadge />}
                {vrTours?.has(lot.id) && <VrTourBadge />}
                {cert && <AuthenticatedBadge />}
                {cert && <VerificationLevelChip level={cert.verification_level} />}
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
                {models?.has(lot.id) && (
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setViewing({ lot, tab: "3d" })}>
                    <Box className="mr-1 h-3.5 w-3.5" />
                    Xem 3D
                  </Button>
                )}
                {vrTours?.has(lot.id) && (
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setViewing({ lot, tab: "vr" })}>
                    <Rotate3d className="mr-1 h-3.5 w-3.5" />
                    Xem VR tour
                  </Button>
                )}
                {cert && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    title={`${cert.partner_name}${cert.certificate_no ? ` · số ${cert.certificate_no}` : ""}`}
                    onClick={() => openCertificate(cert.certificate_path)}
                  >
                    <FileText className="mr-1 h-3.5 w-3.5" />
                    Xem chứng thư giám định
                  </Button>
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

      {viewing && (viewingModel || viewingVr) && (
        <Lot3dDialog
          open
          onOpenChange={(open) => !open && setViewing(null)}
          lotNo={viewing.lot.lot_no}
          title={viewing.lot.title}
          imageUrl={viewing.lot.image_url}
          model={viewingModel}
          vrUrl={viewingVr?.vr_url}
          defaultTab={viewing.tab}
        />
      )}
    </div>
  );
}

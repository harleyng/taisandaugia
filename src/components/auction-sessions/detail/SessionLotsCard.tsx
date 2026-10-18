import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Box, Building2, FileText, MapPin, Package, Rotate3d, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHILD_NAME, PARENT_NAME } from "@/constants/category.constants";
import { formatMoneyFull } from "@/utils/money";
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
import { SectionCard } from "./ui";

const categoryName = (slug: string | null) => (slug ? (CHILD_NAME[slug] ?? PARENT_NAME[slug] ?? null) : null);

interface Props {
  lots: AuctionSessionItem[];
  models?: Map<string, Lot3dModel>;
  vrTours?: Map<string, LotVrTour>;
  authentications?: Map<string, LotAuthentication>;
}

/**
 * "Danh sách tài sản" — đọc SNAPSHOT lô, không JOIN sang nguồn.
 * `models` / `vrTours` / `authentications` thêm nhãn + nút xem 3D (BR-3D-03), VR (BR-VR-04)
 * và chứng thư giám định (chỉ kết luận xác thực mới tới đây).
 */
export function SessionLotsCard({ lots, models, vrTours, authentications }: Props) {
  const [viewing, setViewing] = useState<{ lot: AuctionSessionItem; tab: LotMediaTab } | null>(null);
  const viewingModel = viewing ? models?.get(viewing.lot.id) : undefined;
  const viewingVr = viewing ? vrTours?.get(viewing.lot.id) : undefined;

  return (
    <SectionCard icon={Building2} title="Danh sách tài sản">
      {lots.length === 0 ? (
        <p className="px-4 pb-6 text-center text-sm text-muted-foreground">Phiên chưa có tài sản.</p>
      ) : (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {lots.map((lot) => {
            const location = [lot.district, lot.province].filter(Boolean).join(", ");
            const category = categoryName(lot.category_slug);
            const cert = authentications?.get(lot.id);
            const href = lot.source === "listing" && lot.listing_id ? `/auctions/${lot.listing_id}` : null;
            const extras = models?.has(lot.id) || vrTours?.has(lot.id) || cert;
            return (
              <div
                key={lot.id}
                className="group grid grid-cols-1 gap-x-4 gap-y-3 rounded-[14px] bg-muted p-3 transition-all hover:-translate-y-px hover:bg-border/70 sm:grid-cols-[150px_minmax(0,1fr)]"
              >
                <div className="relative h-[150px] w-full overflow-hidden rounded-xl bg-card sm:h-[108px] sm:w-[150px]">
                  {lot.image_url ? (
                    <img src={lot.image_url} alt={lot.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 flex h-[22px] items-center rounded-full bg-foreground/70 px-2 text-[11px] font-semibold text-background backdrop-blur-sm">
                    Tài sản {lot.lot_no}
                  </span>
                </div>

                <div className="flex min-w-0 flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="my-0.5 text-[15px] font-semibold leading-snug text-foreground">
                        {href ? (
                          <Link to={href} className="hover:text-primary">
                            {lot.title}
                          </Link>
                        ) : (
                          lot.title
                        )}
                      </div>
                      {(category || extras) && (
                        <div className="mb-1 mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-medium">
                          {category && (
                            <span className="flex items-center gap-1.5">
                              <Tag className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.8} />
                              {category}
                            </span>
                          )}
                          {models?.has(lot.id) && <Model3dBadge />}
                          {vrTours?.has(lot.id) && <VrTourBadge />}
                          {cert && <AuthenticatedBadge />}
                          {cert && <VerificationLevelChip level={cert.verification_level} />}
                        </div>
                      )}
                      {location && (
                        <div className="flex items-start gap-1.5 text-[13px] text-muted-foreground">
                          <MapPin className="mt-0.5 h-[15px] w-[15px] shrink-0" strokeWidth={1.8} />
                          <span>{location}</span>
                        </div>
                      )}
                    </div>
                    {href && (
                      <Link
                        to={href}
                        aria-label="Chi tiết tài sản"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card transition-colors group-hover:bg-primary"
                      >
                        <ArrowUpRight className="h-5 w-5 text-foreground group-hover:text-primary-foreground" />
                      </Link>
                    )}
                  </div>

                  <dl className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-6 gap-y-2">
                    {[
                      ["Giá khởi điểm", lot.starting_price],
                      ["Tiền đặt trước", lot.deposit_amount],
                      ["Bước giá", lot.bid_step],
                    ].map(([label, value]) => (
                      <div key={label as string} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="truncate text-sm font-semibold text-foreground">
                          {formatMoneyFull(value as number | null)}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {extras && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
    </SectionCard>
  );
}

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, ChevronRight, Heart, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAssetActions } from "@/hooks/useAssetActions";
import { formatPrice, formatAddress } from "@/utils/formatters";
import { cn } from "@/lib/utils";

export const NotificationsTab = () => {
  const { savedIds, toggleSave } = useAssetActions();
  const [open, setOpen] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const count = savedIds.size;

  useEffect(() => {
    if (!open) return;
    const ids = Array.from(savedIds);
    if (ids.length === 0) {
      setListings([]);
      return;
    }
    setLoading(true);
    supabase
      .from("listings")
      .select("id, title, price, price_unit, address")
      .in("id", ids)
      .then(({ data }) => {
        setListings(data || []);
        setLoading(false);
      });
  }, [open, savedIds]);

  return (
    <div className="space-y-5">
      <Card className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Thông báo</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bạn sẽ nhận thông báo khi có cập nhật về các tài sản đang theo dõi —
              lịch đấu giá, giá khởi điểm, trạng thái phiên.
            </p>
          </div>
        </div>
      </Card>

      {count > 0 ? (
        <Card className="overflow-hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
            aria-expanded={open}
          >
            <div className="h-11 w-11 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
              <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                Đang theo dõi {count} tài sản
              </p>
              <p className="text-sm text-muted-foreground">
                {open ? "Ẩn danh sách" : "Xem danh sách chi tiết"}
              </p>
            </div>
            <ChevronRight
              className={cn(
                "h-5 w-5 text-muted-foreground shrink-0 transition-transform",
                open && "rotate-90",
              )}
            />
          </button>

          {open && (
            <div className="border-t border-border p-4 space-y-2.5">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </>
              ) : listings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Không tải được danh sách. Thử lại sau.
                </p>
              ) : (
                listings.map((listing) => {
                  const addr = formatAddress(listing.address || {});
                  return (
                    <div
                      key={listing.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/auctions/${listing.id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                        >
                          {listing.title}
                        </Link>
                        {addr && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {addr}
                          </p>
                        )}
                        <p className="text-sm font-bold text-primary mt-0.5">
                          {formatPrice(listing.price, listing.price_unit)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => toggleSave(listing.id)}
                        aria-label="Ngừng theo dõi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-10 md:p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
            <Heart className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground">
            Chưa theo dõi tài sản nào
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Bấm "Nhận thông báo khi có cập nhật" trên tài sản bạn quan tâm để được
            cập nhật khi có thay đổi.
          </p>
          <Button asChild className="mt-5">
            <Link to="/listings">Khám phá tài sản</Link>
          </Button>
        </Card>
      )}
    </div>
  );
};

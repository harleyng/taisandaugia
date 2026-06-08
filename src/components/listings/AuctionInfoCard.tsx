import { Badge } from "@/components/ui/badge";
import { Gavel, MapPin, Calendar, Clock, Banknote, TrendingUp } from "lucide-react";
import { formatPrice, formatDate } from "@/utils/formatters";
import { InfoCardShell } from "@/components/shared/InfoCardShell";

interface AuctionInfoCardProps {
  price: number;
  priceUnit: string;
  customAttributes: {
    bid_step?: number;
    deposit_amount?: number;
    auction_time?: string;
    auction_location?: string;
    registration_deadline?: string;
  };
  isLoggedIn?: boolean;
}

export const AuctionInfoCard = ({ price, priceUnit, customAttributes, isLoggedIn = true }: AuctionInfoCardProps) => {
  const {
    bid_step,
    deposit_amount,
    auction_time,
    auction_location,
    registration_deadline,
  } = customAttributes;

  const formatAuctionTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <InfoCardShell
      title="Thông tin đấu giá"
      headerVariant="primary"
      icon={<Gavel className="w-5 h-5 text-primary-foreground" />}
      className="border-primary/20"
      bodyClassName="space-y-4"
    >
        {/* Giá khởi điểm */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Banknote className="w-4 h-4" />
            Giá khởi điểm
          </p>
          <p className="text-2xl font-bold text-primary">
            {formatPrice(price, priceUnit)}
          </p>
        </div>

        <div className="h-px bg-border" />

        {/* Bước giá */}
        {bid_step != null && isLoggedIn && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Bước giá
            </span>
            <span className="font-semibold text-foreground">
              {formatPrice(bid_step, "TOTAL")}
            </span>
          </div>
        )}

        {/* Tiền đặt trước */}
        {deposit_amount != null && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Banknote className="w-4 h-4" />
              Tiền đặt trước
            </span>
            <span className="font-semibold text-foreground">
              {formatPrice(deposit_amount, "TOTAL")}
            </span>
          </div>
        )}

        {(bid_step != null || deposit_amount != null) && <div className="h-px bg-border" />}

        {/* Thời gian đấu giá */}
        {auction_time && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Thời gian đấu giá
            </p>
            <p className="font-medium text-foreground">
              {formatAuctionTime(auction_time)}
            </p>
          </div>
        )}

        {/* Hạn đăng ký */}
        {registration_deadline && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Hạn đăng ký tham gia
            </p>
            <Badge variant="outline" className="text-sm font-medium">
              {formatDate(registration_deadline)}
            </Badge>
          </div>
        )}

        {/* Địa điểm */}
        {auction_location && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              Địa điểm đấu giá
            </p>
            <p className="font-medium text-foreground">{auction_location}</p>
          </div>
        )}
    </InfoCardShell>
  );
};

import { Badge } from "@/components/ui/badge";
import { 
  Wifi, Car, Shield, Wind, Droplets, Zap, Waves, 
  Dumbbell, Coffee, TreePine, UtensilsCrossed, ShoppingCart,
  GraduationCap, Hospital, Bus, Building2, Home, Sparkles
} from "lucide-react";

interface AmenitiesDisplayProps {
  amenities: string[];
  className?: string;
}

const getAmenityIcon = (amenity: string) => {
  const amenityLower = amenity.toLowerCase();
  
  if (amenityLower.includes("wifi") || amenityLower.includes("internet")) return Wifi;
  if (amenityLower.includes("xe") || amenityLower.includes("ô tô") || amenityLower.includes("gara")) return Car;
  if (amenityLower.includes("bảo vệ") || amenityLower.includes("an ninh")) return Shield;
  if (amenityLower.includes("điều hòa") || amenityLower.includes("máy lạnh")) return Wind;
  if (amenityLower.includes("nước nóng") || amenityLower.includes("bình nóng")) return Droplets;
  if (amenityLower.includes("điện") || amenityLower.includes("máy giặt")) return Zap;
  if (amenityLower.includes("bể bơi") || amenityLower.includes("hồ bơi")) return Waves;
  if (amenityLower.includes("gym") || amenityLower.includes("thể dục")) return Dumbbell;
  if (amenityLower.includes("cafe") || amenityLower.includes("quán")) return Coffee;
  if (amenityLower.includes("vườn") || amenityLower.includes("cây xanh")) return TreePine;
  if (amenityLower.includes("nhà hàng") || amenityLower.includes("ăn uống")) return UtensilsCrossed;
  if (amenityLower.includes("siêu thị") || amenityLower.includes("chợ")) return ShoppingCart;
  if (amenityLower.includes("trường") || amenityLower.includes("học")) return GraduationCap;
  if (amenityLower.includes("bệnh viện") || amenityLower.includes("y tế")) return Hospital;
  if (amenityLower.includes("xe buýt") || amenityLower.includes("giao thông")) return Bus;
  if (amenityLower.includes("thang máy")) return Building2;
  if (amenityLower.includes("nội thất")) return Home;
  
  return Sparkles;
};

export const AmenitiesDisplay = ({ amenities, className = "" }: AmenitiesDisplayProps) => {
  if (!amenities || amenities.length === 0) {
    return <p className="text-muted-foreground">Chưa có thông tin tiện ích</p>;
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${className}`}>
      {amenities.map((amenity, index) => {
        const Icon = getAmenityIcon(amenity);
        return (
          <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Icon className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-foreground truncate">{amenity}</span>
          </div>
        );
      })}
    </div>
  );
};

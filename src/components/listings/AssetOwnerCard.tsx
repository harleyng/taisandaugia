import { Card } from "@/components/ui/card";
import { User, MapPin } from "lucide-react";

interface AssetOwnerCardProps {
  name?: string | null;
  address?: string | null;
}

export const AssetOwnerCard = ({ name, address }: AssetOwnerCardProps) => {
  if (!name && !address) return null;

  return (
    <Card className="overflow-hidden">
      <div className="bg-muted px-5 py-3">
        <h2 className="text-lg font-bold text-foreground">Thông tin người có tài sản</h2>
      </div>
      <div className="p-5 space-y-3">
        {name && (
          <div className="flex items-start gap-2.5">
            <User className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Tên đơn vị</p>
              <p className="font-semibold text-foreground text-sm">{name}</p>
            </div>
          </div>
        )}
        {address && (
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Địa chỉ</p>
              <p className="text-foreground text-sm">{address}</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

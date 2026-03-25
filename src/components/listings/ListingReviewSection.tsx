import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ListingReviewSectionProps {
  data: {
    purpose: string;
    propertyType: string;
    address: string;
    area: string;
    price: string;
    priceUnit: string;
    title: string;
  };
}

export const ListingReviewSection = ({ data }: ListingReviewSectionProps) => {
  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle className="text-lg">Xem lại thông tin</CardTitle>
        <CardDescription>
          Kiểm tra lại các thông tin chính trước khi gửi tin đăng
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Mục đích:</p>
            <p className="font-medium">{data.purpose}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Loại hình:</p>
            <p className="font-medium">{data.propertyType}</p>
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-muted-foreground text-sm">Địa chỉ:</p>
          <p className="font-medium">{data.address || "Chưa nhập"}</p>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Diện tích:</p>
            <p className="font-medium">{data.area} m²</p>
          </div>
          <div>
            <p className="text-muted-foreground">Giá:</p>
            <p className="font-medium">{data.price} ({data.priceUnit})</p>
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-muted-foreground text-sm">Tiêu đề:</p>
          <p className="font-medium">{data.title || "Chưa nhập"}</p>
        </div>
      </CardContent>
    </Card>
  );
};

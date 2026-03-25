import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, DollarSign, User, Phone, Mail, FileText, Image as ImageIcon } from "lucide-react";

interface ListingFormStep10ReviewProps {
  data: {
    purpose: string;
    propertyType: string;
    province: string;
    district: string;
    ward: string;
    street: string;
    apartmentFloorInfo?: string;
    buildingName?: string;
    area: string;
    numBedrooms?: string;
    numBathrooms?: string;
    numFloors?: string;
    floorNumber?: string;
    houseDirection?: string;
    balconyDirection?: string;
    legalStatus?: string;
    interiorStatus?: string;
    facadeWidth?: string;
    alleyWidth?: string;
    amenities: string[];
    price: string;
    priceUnit: string;
    fees: Array<{
      category: string;
      feeName: string;
      paymentFrequency: string;
      feeType: string;
      amount: number;
      maxAmount?: number;
      isRefundable?: boolean;
    }>;
    title: string;
    description: string;
    prominentFeatures: string;
    imagePreviewUrls: string[];
    contactName: string;
    contactPhone: string;
    contactEmail: string;
  };
}

const paymentFrequencyLabels: Record<string, string> = {
  monthly: "Hàng tháng",
  quarterly: "Hàng quý",
  yearly: "Hàng năm",
  "one-time": "Một lần"
};

const categoryNames: Record<string, string> = {
  administrative: "Phí hành chính",
  parking: "Phí đỗ xe",
  utilities: "Phí tiện ích",
  other: "Các danh mục khác"
};

export const ListingFormStep10Review = ({ data }: ListingFormStep10ReviewProps) => {
  const fullAddress = [
    data.apartmentFloorInfo,
    data.buildingName,
    data.street,
    data.ward,
    data.district,
    data.province
  ].filter(Boolean).join(", ");

  const amenityLabels: Record<string, string> = {
    full_furnished: "Nội thất đầy đủ",
    basic_furnished: "Nội thất cơ bản",
    unfurnished: "Không nội thất",
    parking: "Chỗ đậu xe",
    balcony: "Ban công",
    terrace: "Sân thượng",
    garden: "Sân vườn",
    swimming_pool: "Hồ bơi",
    gym: "Phòng gym",
    elevator: "Thang máy",
    security: "An ninh 24/7",
    pets_allowed: "Cho phép nuôi thú cưng"
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Xem lại thông tin</h2>
        <p className="text-muted-foreground text-lg">
          Kiểm tra kỹ tất cả thông tin trước khi gửi tin đăng
        </p>
      </div>

      {/* Property Type & Purpose */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Home className="h-5 w-5" />
            Loại hình bất động sản
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Mục đích</p>
              <p className="font-medium">{data.purpose}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Loại hình</p>
              <p className="font-medium">{data.propertyType}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            Vị trí
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Địa chỉ đầy đủ</p>
            <p className="font-medium">{fullAddress}</p>
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Thông tin cơ bản
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Diện tích</p>
              <p className="font-medium">{data.area} m²</p>
            </div>
            {data.numBedrooms && (
              <div>
                <p className="text-sm text-muted-foreground">Phòng ngủ</p>
                <p className="font-medium">{data.numBedrooms}</p>
              </div>
            )}
            {data.numBathrooms && (
              <div>
                <p className="text-sm text-muted-foreground">Phòng tắm</p>
                <p className="font-medium">{data.numBathrooms}</p>
              </div>
            )}
            {data.numFloors && (
              <div>
                <p className="text-sm text-muted-foreground">Số tầng</p>
                <p className="font-medium">{data.numFloors}</p>
              </div>
            )}
            {data.floorNumber && (
              <div>
                <p className="text-sm text-muted-foreground">Tầng</p>
                <p className="font-medium">{data.floorNumber}</p>
              </div>
            )}
          </div>

          {(data.houseDirection || data.balconyDirection || data.legalStatus || data.interiorStatus || data.facadeWidth || data.alleyWidth) && (
            <>
              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {data.houseDirection && (
                  <div>
                    <p className="text-sm text-muted-foreground">Hướng nhà</p>
                    <p className="font-medium">{data.houseDirection}</p>
                  </div>
                )}
                {data.balconyDirection && (
                  <div>
                    <p className="text-sm text-muted-foreground">Hướng ban công</p>
                    <p className="font-medium">{data.balconyDirection}</p>
                  </div>
                )}
                {data.legalStatus && (
                  <div>
                    <p className="text-sm text-muted-foreground">Pháp lý</p>
                    <p className="font-medium">{data.legalStatus}</p>
                  </div>
                )}
                {data.interiorStatus && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tình trạng nội thất</p>
                    <p className="font-medium">{data.interiorStatus}</p>
                  </div>
                )}
                {data.facadeWidth && (
                  <div>
                    <p className="text-sm text-muted-foreground">Mặt tiền</p>
                    <p className="font-medium">{data.facadeWidth} m</p>
                  </div>
                )}
                {data.alleyWidth && (
                  <div>
                    <p className="text-sm text-muted-foreground">Hẻm</p>
                    <p className="font-medium">{data.alleyWidth} m</p>
                  </div>
                )}
              </div>
            </>
          )}

          {data.amenities.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Tiện nghi</p>
                <div className="flex flex-wrap gap-2">
                  {data.amenities.map((amenity) => (
                    <Badge key={amenity} variant="secondary">
                      {amenityLabels[amenity] || amenity}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Price & Fees */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Giá & Chi phí
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Giá</p>
            <p className="font-medium text-lg">
              {new Intl.NumberFormat('vi-VN').format(Number(data.price))} đ
              <span className="text-sm text-muted-foreground ml-2">({data.priceUnit})</span>
            </p>
          </div>

          {data.fees.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-3">Các khoản phí</p>
                <div className="space-y-2">
                  {data.fees.map((fee, index) => (
                    <div key={index} className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{fee.feeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {categoryNames[fee.category]} · {paymentFrequencyLabels[fee.paymentFrequency]}
                          {fee.isRefundable !== undefined && ` · ${fee.isRefundable ? 'Có hoàn lại' : 'Không hoàn lại'}`}
                        </p>
                      </div>
                      <p className="font-medium text-sm">
                        {fee.feeType === "usage-based" ? (
                          "Dựa trên mức độ sử dụng"
                        ) : fee.feeType === "range" && fee.maxAmount ? (
                          `${new Intl.NumberFormat('vi-VN').format(fee.amount)} - ${new Intl.NumberFormat('vi-VN').format(fee.maxAmount)} đ`
                        ) : (
                          `${new Intl.NumberFormat('vi-VN').format(fee.amount)} đ`
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Title, Description & Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="h-5 w-5" />
            Hình ảnh & Mô tả
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.imagePreviewUrls.length > 0 && (
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-3">Hình ảnh ({data.imagePreviewUrls.length} ảnh)</p>
                <div className="grid grid-cols-3 gap-3">
                  {data.imagePreviewUrls.map((url, index) => (
                    <div key={index} className="aspect-square rounded-lg overflow-hidden border bg-muted">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}


          <div>
            <p className="text-sm text-muted-foreground mb-1">Tiêu đề</p>
            <p className="font-medium">{data.title}</p>
          </div>

          <Separator />

          <div>
            <p className="text-sm text-muted-foreground mb-1">Mô tả</p>
            <p className="text-sm whitespace-pre-wrap">{data.description}</p>
          </div>

          {data.prominentFeatures && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Đặc điểm nổi bật</p>
                <div className="flex flex-wrap gap-2">
                  {data.prominentFeatures.split(',').map((feature, index) => (
                    <Badge key={index} variant="secondary">
                      {feature.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Thông tin liên hệ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium">{data.contactName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium">{data.contactPhone}</p>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium">{data.contactEmail}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

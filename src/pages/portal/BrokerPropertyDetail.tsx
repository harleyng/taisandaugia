import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useListingContact } from "@/hooks/useListingContact";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ImageGallery } from "@/components/listings/ImageGallery";
import { AmenitiesDisplay } from "@/components/listings/AmenitiesDisplay";
import { FeesTable } from "@/components/listings/FeesTable";
import { LocationMap } from "@/components/listings/LocationMap";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  MapPin, Phone, Mail, User, Eye, 
  ArrowLeft, ExternalLink, Edit, Loader2, Building2,
  Power, CheckCircle, FileText, Sparkles, MoreVertical
} from "lucide-react";
import { PURPOSES } from "@/constants/listing.constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatDate } from "@/utils/formatters";
import { useIsMobile } from "@/hooks/use-mobile";

const BrokerPropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: contactData, isLoading: contactLoading } = useListingContact(id || "");
  const contactInfo = contactData?.contact_info || null;

  useEffect(() => {
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    if (!id) {
      setError("ID không hợp lệ");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Vui lòng đăng nhập");
        setLoading(false);
        return;
      }
      
      const { data: listingData, error: listingError } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .single();

      if (listingError) throw listingError;

      if (!listingData) {
        setError("Không tìm thấy tin đăng hoặc bạn không có quyền xem");
        setLoading(false);
        return;
      }

      const { data: propertyTypeData } = await supabase
        .from("property_types")
        .select("name, slug")
        .eq("slug", listingData.property_type_slug)
        .single();

      setListing({
        ...listingData,
        property_types: propertyTypeData || { name: "BĐS", slug: listingData.property_type_slug }
      });
      setError(null);
    } catch (err: any) {
      console.error("Error fetching listing:", err);
      setError(err.message || "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const updateListingStatus = async (newStatus: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: newStatus as any })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Cập nhật thành công",
        description: `Trạng thái đã được cập nhật`,
      });

      fetchListing();
    } catch (error: any) {
      toast({
        title: "Lỗi cập nhật",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const formatPrice = (price: number, priceUnit: string) => {
    if (priceUnit === "TOTAL") {
      if (price >= 1000000000) {
        return `${(price / 1000000000).toFixed(1)} tỷ`;
      } else if (price >= 1000000) {
        return `${(price / 1000000).toFixed(0)} triệu`;
      }
      return `${price.toLocaleString()} VND`;
    }
    return `${price.toLocaleString()} VND`;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: "Bản nháp",
      PENDING_APPROVAL: "Chờ duyệt",
      ACTIVE: "Đang hoạt động",
      INACTIVE: "Ngừng hoạt động",
      SOLD: "Đã bán",
      RENTED: "Đã cho thuê",
    };
    return labels[status] || status;
  };

  if (!id || error) {
    return (
      <div className="min-h-screen bg-background p-3 md:px-4 md:py-6">
        <div className="max-w-[1400px] mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {error || "Không tìm thấy tin đăng"}
          </h1>
          <Button onClick={() => navigate("/broker/properties")} className="mt-4">
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-3 md:px-4 md:py-6">
        <div className="max-w-[1400px] mx-auto">
          <Skeleton className="h-10 w-full max-w-md mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
            <div className="lg:col-span-2 space-y-3 md:space-y-6">
              <Skeleton className="aspect-video w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-8 w-full max-w-xs" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background p-3 md:px-4 md:py-6">
        <div className="max-w-[1400px] mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">Không tìm thấy tin đăng</h1>
          <Button onClick={() => navigate("/broker/properties")} className="mt-4">
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  const address = listing.address || {};
  const addressText = [address.street, address.ward, address.district, address.province]
    .filter(Boolean)
    .join(", ");
  
  const images = listing.image_url ? [listing.image_url] : [];
  const propertyTypeName = listing.property_types?.name || "BĐS";
  const purposeLabel = listing.purpose === "FOR_SALE" ? PURPOSES.FOR_SALE : PURPOSES.FOR_RENT;
  const coordinates = listing.coordinates || {};
  const customAttributes = listing.custom_attributes || {};
  const amenities = customAttributes.amenities || [];

  return (
    <div className="min-h-screen bg-background p-3 md:px-4 md:py-6 pb-24 md:pb-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Mobile Header */}
        {isMobile ? (
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/broker/properties")}
              className="touch-manipulation active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="touch-manipulation active:scale-95">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate(`/broker/properties/${listing.id}/edit`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Chỉnh sửa
                </DropdownMenuItem>
                {listing.status === "ACTIVE" && (
                  <DropdownMenuItem 
                    onClick={() => updateListingStatus("INACTIVE")}
                    disabled={actionLoading}
                  >
                    <Power className="mr-2 h-4 w-4" />
                    Ngừng hoạt động
                  </DropdownMenuItem>
                )}
                {listing.status !== "SOLD" && listing.status !== "RENTED" && (
                  <DropdownMenuItem 
                    onClick={() => updateListingStatus(listing.purpose === "FOR_SALE" ? "SOLD" : "RENTED")}
                    disabled={actionLoading}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Đánh dấu {listing.purpose === "FOR_SALE" ? "Đã bán" : "Đã cho thuê"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => window.open(`/listings/${listing.id}`, '_blank')}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Xem trên sàn
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          /* Desktop Header */
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/broker/properties")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại danh sách
            </Button>
            
            <div className="flex gap-2">
              <Button
                onClick={() => navigate(`/broker/properties/${listing.id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Chỉnh sửa
              </Button>
              {listing.status === "ACTIVE" && (
                <Button
                  variant="secondary"
                  onClick={() => updateListingStatus("INACTIVE")}
                  disabled={actionLoading}
                >
                  <Power className="mr-2 h-4 w-4" />
                  Ngừng hoạt động
                </Button>
              )}
              {listing.status !== "SOLD" && listing.status !== "RENTED" && (
                <Button
                  variant="outline"
                  onClick={() => updateListingStatus(listing.purpose === "FOR_SALE" ? "SOLD" : "RENTED")}
                  disabled={actionLoading}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Đánh dấu {listing.purpose === "FOR_SALE" ? "Đã bán" : "Đã cho thuê"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => window.open(`/listings/${listing.id}`, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Xem trên sàn
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-3 md:space-y-6">
            {/* Tổng quan */}
            <Card className="p-4 md:p-6">
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-start justify-between gap-2 md:gap-4">
                  <h1 className="text-xl md:text-3xl font-bold text-foreground flex-1 line-clamp-2">{listing.title}</h1>
                  <Badge 
                    variant={listing.status === "ACTIVE" ? "default" : listing.status === "PENDING_APPROVAL" ? "secondary" : "outline"} 
                    className="text-xs md:text-base flex-shrink-0"
                  >
                    {getStatusLabel(listing.status)}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 md:gap-4">
                  <p className="text-2xl md:text-4xl font-bold text-primary">
                    {formatPrice(listing.price, listing.price_unit)}
                  </p>
                  {listing.price_unit === "PER_SQM" && (
                    <span className="text-sm md:text-base text-muted-foreground">/m²</span>
                  )}
                  {listing.price_unit === "PER_MONTH" && (
                    <span className="text-sm md:text-base text-muted-foreground">/tháng</span>
                  )}
                </div>
                
                {listing.prominent_features && listing.prominent_features.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {listing.prominent_features.map((feature: string, index: number) => (
                      <Badge key={index} variant="secondary">
                        <Sparkles className="mr-1 h-3 w-3" />
                        {feature}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 pt-3 md:pt-4 border-t">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Ngày tạo</p>
                    <p className="text-sm md:text-base font-medium">{formatDate(listing.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Cập nhật</p>
                    <p className="text-sm md:text-base font-medium">{formatDate(listing.updated_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Lượt xem</p>
                    <p className="text-sm md:text-base font-medium flex items-center gap-1">
                      <Eye className="h-3 w-3 md:h-4 md:w-4" />
                      {listing.views_count || 0}
                    </p>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-xs md:text-sm text-muted-foreground">Trạng thái</label>
                    <Select 
                      value={listing.status} 
                      onValueChange={updateListingStatus}
                      disabled={actionLoading}
                    >
                      <SelectTrigger className="h-8 md:h-9 text-xs md:text-sm touch-manipulation">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Bản nháp</SelectItem>
                        <SelectItem value="PENDING_APPROVAL">Chờ duyệt</SelectItem>
                        <SelectItem value="ACTIVE">Đang hoạt động</SelectItem>
                        <SelectItem value="INACTIVE">Ngừng hoạt động</SelectItem>
                        <SelectItem value="SOLD">Đã bán</SelectItem>
                        <SelectItem value="RENTED">Đã cho thuê</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Card>

            {/* Accordion Sections */}
            <Accordion type="multiple" defaultValue={isMobile ? [] : ["specs", "content"]} className="space-y-3 md:space-y-4">
              {/* THÔNG SỐ KỸ THUẬT */}
              <AccordionItem value="specs">
                <Card>
                  <AccordionTrigger className="px-4 md:px-6 py-3 md:py-4 hover:no-underline touch-manipulation">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      <h2 className="text-base md:text-xl font-semibold">Thông số kỹ thuật</h2>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="space-y-4 md:space-y-6 pt-0 px-4 md:px-6">
                      <div>
                        <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3">Hình ảnh ({images.length})</h3>
                        <ImageGallery images={images} title={listing.title} />
                      </div>

                      <div>
                        <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3">Vị trí & Loại hình</h3>
                        <div className="grid grid-cols-1 gap-2 md:gap-4">
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Loại giao dịch</span>
                            <span className="font-medium">{purposeLabel}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Loại BĐS</span>
                            <span className="font-medium">{propertyTypeName}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b col-span-2">
                            <span className="text-muted-foreground">Địa chỉ</span>
                            <span className="font-medium text-right">{addressText}</span>
                          </div>
                          {listing.project_name && (
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-muted-foreground">Dự án</span>
                              <span className="font-medium">{listing.project_name}</span>
                            </div>
                          )}
                          {listing.building_name && (
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-muted-foreground">Tòa nhà</span>
                              <span className="font-medium">{listing.building_name}</span>
                            </div>
                          )}
                        </div>
                        {coordinates.lat && coordinates.lng && (
                          <div className="mt-4">
                            <LocationMap latitude={coordinates.lat} longitude={coordinates.lng} />
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3">Thông số vật lý</h3>
                        <div className="grid grid-cols-1 gap-2 md:gap-4">
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Diện tích</span>
                            <span className="font-medium">{listing.area} m²</span>
                          </div>
                          {listing.num_bedrooms && (
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-muted-foreground">Phòng ngủ</span>
                              <span className="font-medium">{listing.num_bedrooms}</span>
                            </div>
                          )}
                          {listing.num_bathrooms && (
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-muted-foreground">Phòng tắm</span>
                              <span className="font-medium">{listing.num_bathrooms}</span>
                            </div>
                          )}
                          {listing.facade_width && (
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-muted-foreground">Mặt tiền</span>
                              <span className="font-medium">{listing.facade_width} m</span>
                            </div>
                          )}
                          {listing.alley_width && (
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-muted-foreground">Độ rộng hẻm</span>
                              <span className="font-medium">{listing.alley_width} m</span>
                            </div>
                          )}
                          {listing.house_direction && (
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-muted-foreground">Hướng nhà</span>
                              <span className="font-medium">{listing.house_direction}</span>
                            </div>
                          )}
                          {listing.legal_status && (
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-muted-foreground">Pháp lý</span>
                              <span className="font-medium">{listing.legal_status}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>

              {/* NỘI DUNG & CHI PHÍ */}
              <AccordionItem value="content">
                <Card>
                  <AccordionTrigger className="px-4 md:px-6 py-3 md:py-4 hover:no-underline touch-manipulation">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      <h2 className="text-base md:text-xl font-semibold">Nội dung & Chi phí</h2>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="space-y-4 md:space-y-6 pt-0 px-4 md:px-6">
                      <div>
                        <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3">Mô tả</h3>
                        <p className="text-sm md:text-base text-foreground whitespace-pre-line">{listing.description || "Chưa có mô tả"}</p>
                      </div>

                      {amenities.length > 0 && (
                        <div>
                          <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3">Tiện ích</h3>
                          <AmenitiesDisplay amenities={amenities} />
                        </div>
                      )}

                      <div>
                        <h3 className="text-sm md:text-base font-semibold mb-2 md:mb-3">Chi phí</h3>
                        <div className="flex justify-between items-center p-3 md:p-4 bg-primary/5 rounded-lg mb-3 md:mb-4">
                          <span className="text-sm md:text-base text-muted-foreground">Giá chính</span>
                          <span className="text-xl md:text-2xl font-bold text-primary">
                            {formatPrice(listing.price, listing.price_unit)}
                          </span>
                        </div>
                        {customAttributes.fees && customAttributes.fees.length > 0 && (
                          <FeesTable fees={customAttributes.fees} serviceCosts={listing.service_costs} />
                        )}
                      </div>
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            </Accordion>

            {/* Contact Info on Mobile - Moved from Sidebar */}
            {isMobile && (
              <Card className="p-4">
                <h2 className="text-base font-semibold mb-3">Thông tin liên hệ</h2>
                
                {contactLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : contactInfo ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Người đăng</p>
                        <p className="text-sm font-medium truncate">{contactInfo.name || 'N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                        <Phone className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Số điện thoại</p>
                        <p className="text-sm font-medium truncate">{contactInfo.phone || 'N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                        <Mail className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-xs font-medium break-all">{contactInfo.email || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Không có thông tin liên hệ
                  </p>
                )}
              </Card>
            )}
          </div>

          {/* Desktop Sidebar - Hidden on Mobile */}
          {!isMobile && (
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-4">
                <h2 className="text-xl font-semibold mb-4">Thông tin liên hệ</h2>
                
                {contactLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : contactInfo ? (
                  <>
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Người đăng</p>
                          <p className="font-medium">{contactInfo.name || 'N/A'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Phone className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Số điện thoại</p>
                          <p className="font-medium">{contactInfo.phone || 'N/A'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Mail className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium text-sm">{contactInfo.email || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button 
                        className="w-full" 
                        size="lg"
                        onClick={() => contactInfo.phone && window.open(`tel:${contactInfo.phone}`)}
                        disabled={!contactInfo.phone}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Gọi điện
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        size="lg"
                        onClick={() => contactInfo.email && window.open(`mailto:${contactInfo.email}`)}
                        disabled={!contactInfo.email}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Gửi email
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Không có thông tin liên hệ
                  </p>
                )}
              </Card>
            </div>
          )}
        </div>

        {/* Mobile Bottom Action Bar - Sticky */}
        {isMobile && contactInfo && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 safe-area-pb">
            <div className="grid grid-cols-2 gap-2 p-3">
              <Button 
                className="w-full touch-manipulation active:scale-95" 
                size="lg"
                onClick={() => contactInfo.phone && window.open(`tel:${contactInfo.phone}`)}
                disabled={!contactInfo.phone}
              >
                <Phone className="w-4 h-4 mr-2" />
                Gọi điện
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full touch-manipulation active:scale-95" 
                size="lg"
                onClick={() => contactInfo.email && window.open(`mailto:${contactInfo.email}`)}
                disabled={!contactInfo.email}
              >
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrokerPropertyDetail;

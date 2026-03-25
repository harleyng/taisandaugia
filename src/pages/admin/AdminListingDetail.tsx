import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useListingContact } from "@/hooks/useListingContact";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAdminCheck } from "@/hooks/useAdminCheck";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  MapPin, Phone, Mail, User, Eye, 
  ArrowLeft, ExternalLink, Loader2, Building2,
  Trash2, FileText, Sparkles, CheckCircle, XCircle
} from "lucide-react";
import { PURPOSES } from "@/constants/listing.constants";
import { formatDate } from "@/utils/formatters";

const AdminListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: contactData, isLoading: contactLoading } = useListingContact(id || "");
  const contactInfo = contactData?.contact_info || null;

  useEffect(() => {
    if (isAdmin) {
      fetchListing();
    }
  }, [isAdmin, id]);

  const fetchListing = async () => {
    if (!id) {
      setError("ID không hợp lệ");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data: listingData, error: listingError } = await supabase
        .from("listings")
        .select(`
          *,
          profiles:user_id (
            email,
            name
          )
        `)
        .eq("id", id)
        .single();

      if (listingError) throw listingError;

      if (!listingData) {
        setError("Không tìm thấy tin đăng");
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

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: "ACTIVE" as any })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Đã duyệt tin đăng",
        description: "Tin đăng đã được kích hoạt thành công",
      });

      fetchListing();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập lý do từ chối",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("listings")
        .update({ 
          status: "INACTIVE" as any,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Đã từ chối tin đăng",
        description: "Tin đăng đã bị từ chối",
      });

      setShowRejectDialog(false);
      setRejectionReason("");
      fetchListing();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Đã xóa tin đăng",
        description: "Tin đăng đã được xóa vĩnh viễn",
      });

      navigate("/admin/properties");
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
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

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  if (!id || error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {error || "Không tìm thấy tin đăng"}
          </h1>
          <Button onClick={() => navigate("/admin/properties")} className="mt-4">
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="container mx-auto">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="aspect-video w-full" />
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
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
      <div className="min-h-screen bg-background p-6">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">Không tìm thấy tin đăng</h1>
          <Button onClick={() => navigate("/admin/properties")} className="mt-4">
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
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/admin/properties")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại danh sách
          </Button>
          
          <Button
            variant="outline"
            onClick={() => window.open(`/listings/${listing.id}`, '_blank')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Xem trên sàn
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-3xl font-bold text-foreground flex-1">{listing.title}</h1>
                  <Badge 
                    variant={listing.status === "ACTIVE" ? "default" : listing.status === "PENDING_APPROVAL" ? "secondary" : "outline"} 
                    className="text-base"
                  >
                    {getStatusLabel(listing.status)}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4">
                  <p className="text-4xl font-bold text-primary">
                    {formatPrice(listing.price, listing.price_unit)}
                  </p>
                  {listing.price_unit === "PER_SQM" && (
                    <span className="text-muted-foreground">/m²</span>
                  )}
                  {listing.price_unit === "PER_MONTH" && (
                    <span className="text-muted-foreground">/tháng</span>
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Người đăng</p>
                    <p className="font-medium text-xs">{listing.profiles?.email || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ngày tạo</p>
                    <p className="font-medium">{formatDate(listing.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cập nhật</p>
                    <p className="font-medium">{formatDate(listing.updated_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lượt xem</p>
                    <p className="font-medium flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {listing.views_count || 0}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Admin Actions */}
            <Card className="p-6 bg-primary/5 border-primary/20">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Hành động quản trị
              </h2>
              <div className="flex flex-wrap gap-2">
                {(listing.status === "PENDING_APPROVAL" || listing.status === "DRAFT") && (
                  <>
                    <Button
                      onClick={handleApprove}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Duyệt tin
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={actionLoading}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Từ chối
                    </Button>
                  </>
                )}

                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={actionLoading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xóa vĩnh viễn
                </Button>
              </div>
            </Card>

            {/* Accordion Sections */}
            <Accordion type="multiple" defaultValue={["specs", "content"]} className="space-y-4">
              {/* THÔNG SỐ KỸ THUẬT */}
              <AccordionItem value="specs">
                <Card>
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold">Thông số kỹ thuật</h2>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="space-y-6 pt-0">
                      <div>
                        <h3 className="font-semibold mb-3">Hình ảnh ({images.length})</h3>
                        <ImageGallery images={images} title={listing.title} />
                      </div>

                      <div>
                        <h3 className="font-semibold mb-3">Vị trí & Loại hình</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <h3 className="font-semibold mb-3">Thông số vật lý</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold">Nội dung & Chi phí</h2>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="space-y-6 pt-0">
                      <div>
                        <h3 className="font-semibold mb-3">Mô tả</h3>
                        <p className="text-foreground whitespace-pre-line">{listing.description || "Chưa có mô tả"}</p>
                      </div>

                      {amenities.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-3">Tiện ích</h3>
                          <AmenitiesDisplay amenities={amenities} />
                        </div>
                      )}

                      <div>
                        <h3 className="font-semibold mb-3">Chi phí</h3>
                        <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg mb-4">
                          <span className="text-muted-foreground">Giá chính</span>
                          <span className="text-2xl font-bold text-primary">
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
          </div>

          {/* Sidebar */}
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
        </div>
      </div>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Từ chối tin đăng</AlertDialogTitle>
            <AlertDialogDescription>
              Vui lòng nhập lý do từ chối tin đăng này
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Lý do từ chối</Label>
            <Textarea
              id="rejection-reason"
              placeholder="Nhập lý do từ chối..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Xác nhận từ chối
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa vĩnh viễn tin đăng</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Tin đăng sẽ bị xóa vĩnh viễn khỏi hệ thống.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={actionLoading} className="bg-destructive hover:bg-destructive/90">
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Xóa vĩnh viễn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminListingDetail;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Eye, Edit, Trash2, Loader2, ExternalLink, MoreVertical } from "lucide-react";
import { ComingSoonOverlay } from "@/components/portal/ComingSoonOverlay";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ListingStatus } from "@/types/listing.types";
import { formatPrice, formatAddress } from "@/utils/formatters";
import { LISTING_STATUSES, PURPOSES } from "@/constants/listing.constants";
import { useIsMobile } from "@/hooks/use-mobile";

export default function BrokerProperties() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [purposeFilter, setPurposeFilter] = useState<string>("ALL");
  const [deleteListingId, setDeleteListingId] = useState<string | null>(null);

  useEffect(() => {
    fetchListings();
  }, [statusFilter, purposeFilter]);

  const fetchListings = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let query = supabase
      .from("listings")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (statusFilter !== "ALL") {
      query = query.eq("status", statusFilter as any);
    }

    if (purposeFilter !== "ALL") {
      query = query.eq("purpose", purposeFilter as any);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách tin đăng",
        variant: "destructive",
      });
    } else {
      setListings(data || []);
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteListingId) return;

    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", deleteListingId);

    if (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa tin đăng",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Thành công",
        description: "Đã xóa tin đăng",
      });
      fetchListings();
    }

    setDeleteListingId(null);
  };

  return (
    <ComingSoonOverlay>
      <div className="space-y-4 md:space-y-6 relative">
        {/* Header - Mobile Optimized */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-3xl font-bold text-foreground truncate">
              {isMobile ? "Tin đăng" : "Quản lý tin đăng"}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Quản lý các tin đăng bất động sản của bạn
            </p>
          </div>
          <Button 
            onClick={() => navigate("/broker/properties/new")}
            size={isMobile ? "sm" : "default"}
            className="touch-manipulation active:scale-95 flex-shrink-0"
          >
            <PlusCircle className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Đăng tin mới</span>
          </Button>
        </div>

        {/* Filters - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px] touch-manipulation">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              {Object.entries(LISTING_STATUSES).map(([key, value]) => (
                <SelectItem key={key} value={key}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={purposeFilter} onValueChange={setPurposeFilter}>
            <SelectTrigger className="w-full sm:w-[200px] touch-manipulation">
              <SelectValue placeholder="Mục đích" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả mục đích</SelectItem>
              {Object.entries(PURPOSES).map(([key, value]) => (
                <SelectItem key={key} value={key}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : listings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm md:text-base text-muted-foreground">Chưa có tin đăng nào</p>
              <Button onClick={() => navigate("/broker/properties/new")} className="mt-4 touch-manipulation active:scale-95">
                Tạo tin đăng đầu tiên
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:gap-4">
            {listings.map((listing) => (
              <Card key={listing.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  {/* Mobile: Vertical Layout, Desktop: Horizontal Layout */}
                  <div className="flex flex-col sm:flex-row">
                    {/* Image */}
                    {listing.image_url && (
                      <div className="relative w-full sm:w-40 h-48 sm:h-auto flex-shrink-0">
                        <img
                          src={listing.image_url}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 sm:hidden">
                          <StatusBadge status={listing.status as ListingStatus} />
                        </div>
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base md:text-lg line-clamp-2 mb-1">
                            {listing.title}
                          </h3>
                          <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                            {formatAddress(listing.address)}
                          </p>
                        </div>
                        <div className="hidden sm:block flex-shrink-0">
                          <StatusBadge status={listing.status as ListingStatus} />
                        </div>
                      </div>
                      
                      <div className="flex items-baseline gap-2 mb-2">
                        <p className="text-primary font-bold text-lg md:text-xl">
                          {formatPrice(listing.price, listing.price_unit)}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          • {listing.area} m²
                        </span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        {/* Mobile: Compact buttons + dropdown */}
                        {isMobile ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => navigate(`/broker/properties/${listing.id}`)}
                              className="flex-1 touch-manipulation active:scale-95"
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              <span className="text-xs">Chi tiết</span>
                            </Button>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="touch-manipulation active:scale-95"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem 
                                  onClick={() => window.open(`/listings/${listing.id}`, '_blank')}
                                  className="touch-manipulation"
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Xem trên sàn
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => navigate(`/broker/properties/${listing.id}/edit`)}
                                  className="touch-manipulation"
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Chỉnh sửa
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setDeleteListingId(listing.id)}
                                  className="text-destructive touch-manipulation"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Xóa
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        ) : (
                          /* Desktop: All buttons visible */
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => navigate(`/broker/properties/${listing.id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Xem chi tiết
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`/listings/${listing.id}`, '_blank')}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Xem trên sàn
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/broker/properties/${listing.id}/edit`)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Sửa
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteListingId(listing.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!deleteListingId} onOpenChange={() => setDeleteListingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa tin đăng này? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Xóa</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ComingSoonOverlay>
  );
}

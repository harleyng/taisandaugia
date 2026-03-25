import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Loader2, Check, X, Power, Trash2, Eye, Shield, ExternalLink } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface AdminListing {
  id: string;
  title: string;
  description: string | null;
  price: number;
  price_unit: string;
  purpose: string;
  status: string;
  property_type_slug: string;
  address: any;
  area: number;
  image_url: string | null;
  created_at: string;
  user_id: string;
  profiles?: {
    email: string;
    name: string | null;
  };
}

const AdminListings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading, session } = useAdminCheck();

  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPurpose, setFilterPurpose] = useState<string>("all");
  const [filterOwnerEmail, setFilterOwnerEmail] = useState<string>("");

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<string | null>(null);

  // Fetch all listings
  useEffect(() => {
    if (isAdmin && session) {
      fetchListings();
    }
  }, [isAdmin, session, filterStatus, filterPurpose]);

  const fetchListings = async () => {
    if (!session) return;

    setLoading(true);
    try {
      let query = supabase
        .from("listings")
        .select(`
          *,
          profiles:user_id (
            email,
            name
          )
        `)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus as any);
      }
      if (filterPurpose !== "all") {
        query = query.eq("purpose", filterPurpose);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Client-side filter by owner email if provided
      let filteredData = data || [];
      if (filterOwnerEmail.trim()) {
        filteredData = filteredData.filter((listing: any) => 
          listing.profiles?.email?.toLowerCase().includes(filterOwnerEmail.toLowerCase())
        );
      }

      setListings(filteredData);
    } catch (error: any) {
      toast({
        title: "Lỗi tải dữ liệu",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateListingStatus = async (listingId: string, newStatus: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "INACTIVE" | "SOLD_RENTED") => {
    setActionLoading(listingId);
    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: newStatus })
        .eq("id", listingId);

      if (error) throw error;

      toast({
        title: "Cập nhật thành công",
        description: `Trạng thái tin đăng đã được cập nhật thành ${getStatusLabel(newStatus)}`,
      });

      fetchListings();
    } catch (error: any) {
      toast({
        title: "Lỗi cập nhật",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const deleteListing = async () => {
    if (!listingToDelete) return;

    setActionLoading(listingToDelete);
    try {
      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", listingToDelete);

      if (error) throw error;

      toast({
        title: "Xóa thành công",
        description: "Tin đăng đã được xóa vĩnh viễn",
      });

      fetchListings();
    } catch (error: any) {
      toast({
        title: "Lỗi xóa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setDeleteDialogOpen(false);
      setListingToDelete(null);
    }
  };

  const formatPrice = (price: number, priceUnit: string) => {
    if (priceUnit === "PER_MONTH") {
      return `${(price / 1000000).toLocaleString('vi-VN')} triệu/tháng`;
    }
    const priceInBillions = price / 1000000000;
    if (priceInBillions >= 1) {
      return `${priceInBillions.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
    }
    return `${(price / 1000000).toLocaleString('vi-VN')} triệu`;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: "Bản nháp",
      PENDING_APPROVAL: "Chờ duyệt",
      ACTIVE: "Đang hoạt động",
      INACTIVE: "Ngừng hoạt động",
      SOLD_RENTED: "Đã bán/thuê",
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { variant: "secondary" as const },
      PENDING_APPROVAL: { variant: "default" as const },
      ACTIVE: { variant: "default" as const },
      INACTIVE: { variant: "secondary" as const },
      SOLD_RENTED: { variant: "secondary" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: "default" as const };
    return <Badge variant={config.variant}>{getStatusLabel(status)}</Badge>;
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

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Quản lý tất cả tin đăng</h1>
              <p className="text-muted-foreground mt-1">
                Quản trị viên - Xem và duyệt tất cả tin đăng trên nền tảng
              </p>
            </div>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Bộ lọc</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="filterStatus">Trạng thái</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger id="filterStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="DRAFT">Bản nháp</SelectItem>
                      <SelectItem value="PENDING_APPROVAL">Chờ duyệt</SelectItem>
                      <SelectItem value="ACTIVE">Đang hoạt động</SelectItem>
                      <SelectItem value="INACTIVE">Ngừng hoạt động</SelectItem>
                      <SelectItem value="SOLD_RENTED">Đã bán/thuê</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filterPurpose">Mục đích</Label>
                  <Select value={filterPurpose} onValueChange={setFilterPurpose}>
                    <SelectTrigger id="filterPurpose">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="FOR_SALE">Bán</SelectItem>
                      <SelectItem value="FOR_RENT">Cho thuê</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filterOwnerEmail">Email người đăng</Label>
                  <div className="flex gap-2">
                    <Input
                      id="filterOwnerEmail"
                      value={filterOwnerEmail}
                      onChange={(e) => setFilterOwnerEmail(e.target.value)}
                      placeholder="Tìm theo email..."
                    />
                    <Button onClick={fetchListings} variant="secondary">
                      Tìm
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Listings */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">Đang tải dữ liệu...</p>
            </div>
          ) : listings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Không tìm thấy tin đăng nào phù hợp với bộ lọc.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {listings.map((listing) => (
                <Card key={listing.id}>
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        {listing.image_url ? (
                          <img
                            src={listing.image_url}
                            alt={listing.title}
                            className="w-48 h-32 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-48 h-32 bg-muted rounded-lg flex items-center justify-center">
                            <span className="text-muted-foreground text-sm">Không có ảnh</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-xl font-semibold mb-1">{listing.title}</h3>
                            <div className="flex gap-2 items-center flex-wrap">
                              {getStatusBadge(listing.status)}
                              <Badge variant="outline">
                                {listing.purpose === "FOR_SALE" ? "Bán" : "Cho thuê"}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                <span className="text-xs">👤</span>
                                {listing.profiles?.email || "Không rõ"}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">
                              {formatPrice(listing.price, listing.price_unit)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {listing.area} m²
                            </p>
                          </div>
                        </div>

                        <p className="text-muted-foreground mb-3 line-clamp-2">
                          {listing.description}
                        </p>

                        <p className="text-sm text-muted-foreground mb-4">
                          📍 {listing.address?.district || "Chưa cập nhật"}
                          {listing.address?.province && `, ${listing.address.province}`}
                        </p>

                        {/* Admin Actions */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => navigate(`/admin/properties/${listing.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Xem chi tiết
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/listings/${listing.id}`, '_blank')}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Xem trên sàn
                          </Button>

                          {(listing.status === "PENDING_APPROVAL" || listing.status === "DRAFT") && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => updateListingStatus(listing.id, "ACTIVE")}
                                disabled={actionLoading === listing.id}
                              >
                                {actionLoading === listing.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="mr-2 h-4 w-4" />
                                )}
                                Duyệt
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateListingStatus(listing.id, "INACTIVE")}
                                disabled={actionLoading === listing.id}
                              >
                                {actionLoading === listing.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="mr-2 h-4 w-4" />
                                )}
                                Từ chối
                              </Button>
                            </>
                          )}

                          {listing.status === "ACTIVE" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateListingStatus(listing.id, "INACTIVE")}
                              disabled={actionLoading === listing.id}
                            >
                              {actionLoading === listing.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Power className="mr-2 h-4 w-4" />
                              )}
                              Ngừng hoạt động
                            </Button>
                          )}

                          {listing.status === "INACTIVE" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateListingStatus(listing.id, "ACTIVE")}
                              disabled={actionLoading === listing.id}
                            >
                              {actionLoading === listing.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Power className="mr-2 h-4 w-4" />
                              )}
                              Kích hoạt
                            </Button>
                          )}

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setListingToDelete(listing.id);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={actionLoading === listing.id}
                          >
                            {actionLoading === listing.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Xóa vĩnh viễn
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa vĩnh viễn</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa vĩnh viễn tin đăng này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setListingToDelete(null)}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction onClick={deleteListing} className="bg-destructive hover:bg-destructive/90">
              Xóa vĩnh viễn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminListings;

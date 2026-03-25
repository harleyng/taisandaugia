import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, AlertCircle, User as UserIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  kyc_status: "NOT_APPLIED" | "PENDING_KYC" | "APPROVED" | "REJECTED";
  agent_info: any;
  rejection_reason: string | null;
  created_at: string;
}

interface UserRole {
  role: string;
}

interface UserWithRole extends UserProfile {
  roles: UserRole[];
}

export default function AdminBrokers() {
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKycStatus, setFilterKycStatus] = useState<string>("ALL");
  const [filterEmail, setFilterEmail] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Build query
      let query = supabase
        .from("profiles")
        .select("*, user_roles(role)")
        .order("created_at", { ascending: false });

      // Apply filters
      if (filterKycStatus !== "ALL") {
        query = query.eq("kyc_status", filterKycStatus as "NOT_APPLIED" | "PENDING_KYC" | "APPROVED" | "REJECTED");
      }

      if (filterEmail) {
        query = query.ilike("email", `%${filterEmail}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to include roles properly
      const usersWithRoles = (data || []).map(user => ({
        ...user,
        roles: Array.isArray(user.user_roles) ? user.user_roles : []
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách người dùng",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveKyc = async (userId: string) => {
    try {
      setSubmitting(true);
      
      console.log("Approving KYC for user:", userId);
      
      // Update profile
      const { data, error } = await supabase
        .from("profiles")
        .update({
          kyc_status: "APPROVED",
          rejection_reason: null,
        })
        .eq("id", userId)
        .select();

      console.log("Update result:", { data, error });

      if (error) {
        console.error("Update error details:", error);
        throw error;
      }

      toast({
        title: "Thành công",
        description: "Đã duyệt hồ sơ môi giới",
      });

      await loadUsers();
    } catch (error) {
      console.error("Error approving KYC:", error);
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể duyệt hồ sơ",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectKyc = async () => {
    if (!selectedUserId || !rejectionReason.trim()) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng nhập lý do từ chối",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          kyc_status: "REJECTED",
          rejection_reason: rejectionReason,
        })
        .eq("id", selectedUserId);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã từ chối hồ sơ môi giới",
      });

      setRejectDialogOpen(false);
      setSelectedUserId(null);
      setRejectionReason("");
      loadUsers();
    } catch (error) {
      console.error("Error rejecting KYC:", error);
      toast({
        title: "Lỗi",
        description: "Không thể từ chối hồ sơ",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeApproval = async (userId: string) => {
    try {
      setSubmitting(true);
      
      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({
          kyc_status: "NOT_APPLIED",
          rejection_reason: null,
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã hủy duyệt hồ sơ môi giới",
      });

      loadUsers();
    } catch (error) {
      console.error("Error revoking approval:", error);
      toast({
        title: "Lỗi",
        description: "Không thể hủy duyệt hồ sơ",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openRejectDialog = (userId: string) => {
    setSelectedUserId(userId);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const getKycStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Đã duyệt</Badge>;
      case "PENDING_KYC":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Chờ duyệt</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Bị từ chối</Badge>;
      default:
        return <Badge variant="outline">Chưa đăng ký</Badge>;
    }
  };

  const getRoleBadge = (roles: UserRole[]) => {
    const roleNames = roles.map(r => r.role);
    if (roleNames.includes("ADMIN")) {
      return <Badge variant="destructive">ADMIN</Badge>;
    }
    return <Badge variant="secondary">USER</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Broker Management</h1>
        <p className="text-muted-foreground">Verify and manage broker KYC applications</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Trạng thái KYC</Label>
              <Select value={filterKycStatus} onValueChange={setFilterKycStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  <SelectItem value="NOT_APPLIED">Chưa đăng ký</SelectItem>
                  <SelectItem value="PENDING_KYC">Chờ duyệt</SelectItem>
                  <SelectItem value="APPROVED">Đã duyệt</SelectItem>
                  <SelectItem value="REJECTED">Bị từ chối</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tìm theo Email</Label>
              <Input
                placeholder="Nhập email..."
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={loadUsers} className="w-full">
                Áp dụng
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Không có người dùng nào phù hợp.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-full">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>{user.name || user.email}</CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {getRoleBadge(user.roles)}
                    {getKycStatusBadge(user.kyc_status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-medium">Ngày tạo:</span>{" "}
                      {new Date(user.created_at).toLocaleDateString("vi-VN")}
                    </div>
                  </div>

                  {/* Agent Info */}
                  {user.agent_info && typeof user.agent_info === 'object' && (
                    <div className="border-t pt-3 mt-3">
                      <h4 className="font-medium mb-2">Thông tin môi giới:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Công ty:</span>{" "}
                          {user.agent_info.companyName || "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">Giấy phép:</span>{" "}
                          {user.agent_info.licenseNumber || "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">Địa chỉ:</span>{" "}
                          {user.agent_info.businessAddress || "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">SĐT công ty:</span>{" "}
                          {user.agent_info.companyPhone || "N/A"}
                        </div>
                      </div>
                      {user.agent_info.profilePicture && (
                        <div className="mt-3">
                          <img 
                            src={user.agent_info.profilePicture} 
                            alt="Profile" 
                            className="w-24 h-24 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {user.kyc_status === "REJECTED" && user.rejection_reason && (
                    <div className="border-t pt-3 mt-3">
                      <div className="flex items-start gap-2 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">Lý do từ chối:</span>{" "}
                          {user.rejection_reason}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Admin Actions */}
                  <div className="flex flex-wrap gap-2 border-t pt-3 mt-3">
                    {user.kyc_status === "PENDING_KYC" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApproveKyc(user.id)}
                          disabled={submitting}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Duyệt KYC
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openRejectDialog(user.id)}
                          disabled={submitting}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Từ chối KYC
                        </Button>
                      </>
                    )}

                    {user.kyc_status === "APPROVED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevokeApproval(user.id)}
                        disabled={submitting}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Hủy duyệt
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối hồ sơ môi giới</DialogTitle>
            <DialogDescription>
              Vui lòng nhập lý do từ chối để người dùng biết và chỉnh sửa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Lý do từ chối *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Ví dụ: Giấy phép không rõ ràng, thiếu thông tin công ty..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setSelectedUserId(null);
                setRejectionReason("");
              }}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectKyc}
              disabled={submitting || !rejectionReason.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                "Gửi từ chối"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrganizationStatusBadge } from "@/components/admin/OrganizationStatusBadge";
import { Organization } from "@/types/organization.types";
import { CheckCircle, XCircle, Eye, Building2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pendingOrgs, setPendingOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrganizations(data as any || []);
      setPendingOrgs(data?.filter((org: any) => org.kyc_status === "PENDING_KYC") as any || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast.error("Không thể tải danh sách tổ chức");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orgId: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ 
          kyc_status: "APPROVED",
          rejection_reason: null 
        })
        .eq("id", orgId);

      if (error) throw error;

      toast.success("Đã duyệt tổ chức");
      fetchOrganizations();
      setReviewDialogOpen(false);
      setSelectedOrg(null);
    } catch (error) {
      console.error("Error approving organization:", error);
      toast.error("Không thể duyệt tổ chức");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (orgId: string) => {
    if (!rejectionReason.trim()) {
      toast.error("Vui lòng nhập lý do từ chối");
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ 
          kyc_status: "REJECTED",
          rejection_reason: rejectionReason 
        })
        .eq("id", orgId);

      if (error) throw error;

      toast.success("Đã từ chối tổ chức");
      fetchOrganizations();
      setReviewDialogOpen(false);
      setSelectedOrg(null);
      setRejectionReason("");
    } catch (error) {
      console.error("Error rejecting organization:", error);
      toast.error("Không thể từ chối tổ chức");
    } finally {
      setProcessing(false);
    }
  };

  const openReviewDialog = (org: Organization) => {
    setSelectedOrg(org);
    setReviewDialogOpen(true);
    setRejectionReason(org.rejection_reason || "");
  };

  const stats = {
    total: organizations.length,
    pending: pendingOrgs.length,
    approved: organizations.filter((o) => o.kyc_status === "APPROVED").length,
    rejected: organizations.filter((o) => o.kyc_status === "REJECTED").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Quản lý tổ chức</h1>
        <p className="text-muted-foreground">Duyệt và quản lý các tổ chức môi giới</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng số</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chờ duyệt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã duyệt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bị từ chối</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            Chờ duyệt ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="all">Tất cả tổ chức</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tổ chức chờ duyệt KYC</CardTitle>
              <CardDescription>
                Xem xét và phê duyệt các yêu cầu KYC của tổ chức
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingOrgs.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  Không có tổ chức nào đang chờ duyệt
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên tổ chức</TableHead>
                      <TableHead>Mã số thuế</TableHead>
                      <TableHead>Giấy phép KD</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingOrgs.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>{org.license_info?.taxId || "—"}</TableCell>
                        <TableCell>{org.license_info?.businessLicenseNumber || "—"}</TableCell>
                        <TableCell>{format(new Date(org.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReviewDialog(org)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Xem xét
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tất cả tổ chức</CardTitle>
              <CardDescription>
                Danh sách đầy đủ các tổ chức trong hệ thống
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên tổ chức</TableHead>
                    <TableHead>Trạng thái KYC</TableHead>
                    <TableHead>Mã số thuế</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        <OrganizationStatusBadge status={org.kyc_status} />
                      </TableCell>
                      <TableCell>{org.license_info?.taxId || "—"}</TableCell>
                      <TableCell>{format(new Date(org.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openReviewDialog(org)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Chi tiết
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết tổ chức</DialogTitle>
            <DialogDescription>
              Xem xét thông tin và duyệt KYC cho tổ chức
            </DialogDescription>
          </DialogHeader>

          {selectedOrg && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">{selectedOrg.name}</h3>
                <OrganizationStatusBadge status={selectedOrg.kyc_status} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mã số thuế</p>
                  <p className="text-sm">{selectedOrg.license_info?.taxId || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Giấy phép KD</p>
                  <p className="text-sm">{selectedOrg.license_info?.businessLicenseNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Người đại diện</p>
                  <p className="text-sm">{selectedOrg.license_info?.legalRepresentative || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Số điện thoại</p>
                  <p className="text-sm">{selectedOrg.license_info?.phoneNumber || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Địa chỉ</p>
                  <p className="text-sm">{selectedOrg.license_info?.address || "—"}</p>
                </div>
              </div>

              {selectedOrg.kyc_status === "PENDING_KYC" && (
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason">Lý do từ chối (nếu từ chối)</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="Nhập lý do từ chối..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}

              {selectedOrg.rejection_reason && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-1">Lý do từ chối</p>
                  <p className="text-sm">{selectedOrg.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedOrg?.kyc_status === "PENDING_KYC" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleReject(selectedOrg.id)}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Từ chối
                </Button>
                <Button
                  onClick={() => handleApprove(selectedOrg.id)}
                  disabled={processing}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Duyệt
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

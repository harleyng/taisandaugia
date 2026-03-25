import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserOrganizations, useOrganizationDetails } from "@/hooks/useOrganization";
import { useOrganizationMembers, useRemoveMember } from "@/hooks/useOrganizationMembership";
import { useUserPermissions } from "@/hooks/useOrganizationRoles";
import { OrganizationStatusBadge } from "@/components/admin/OrganizationStatusBadge";
import { OrganizationSwitcher } from "@/components/organization/OrganizationSwitcher";
import { ORG_ROLE_NAMES, MEMBERSHIP_STATUSES } from "@/constants/organization.constants";
import { Building2, Plus, MoreVertical, UserPlus, Trash2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
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

export default function BrokerOrganization() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organizations, loading: orgsLoading } = useUserOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Initialize selected org from URL or default to first org
  useEffect(() => {
    if (organizations.length > 0) {
      const orgIdFromUrl = searchParams.get("org");
      const validOrgId = orgIdFromUrl && organizations.find(o => o.id === orgIdFromUrl)
        ? orgIdFromUrl
        : organizations[0].id;
      
      setSelectedOrgId(validOrgId);
      
      // Update URL if needed
      if (!orgIdFromUrl || orgIdFromUrl !== validOrgId) {
        setSearchParams({ org: validOrgId }, { replace: true });
      }
    }
  }, [organizations, searchParams, setSearchParams]);

  const { organization } = useOrganizationDetails(selectedOrgId);
  const { members, loading: membersLoading, refetch } = useOrganizationMembers(selectedOrgId);
  const { removeMember } = useRemoveMember();
  const { isOwner, isManager, canRemoveMember } = useUserPermissions(selectedOrgId);

  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    setSearchParams({ org: orgId });
  };

  const currentOrg = organization;

  if (orgsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Tổ chức của bạn</CardTitle>
                <CardDescription>
                  Bạn chưa thuộc tổ chức nào
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Tạo tổ chức mới để quản lý môi giới và tin đăng theo nhóm
            </p>
            <Button onClick={() => navigate("/broker/organization/create")}>
              <Plus className="h-4 w-4 mr-2" />
              Tạo tổ chức mới
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    const success = await removeMember(memberToRemove);
    if (success) {
      refetch();
      setMemberToRemove(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate("/broker/organizations")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Quay lại danh sách
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Chi tiết tổ chức</h1>
            <p className="text-muted-foreground">Quản lý thông tin và thành viên tổ chức</p>
          </div>
          {(isOwner || isManager) && (
            <Button onClick={() => navigate("/broker/organization/invite")}>
              <UserPlus className="h-4 w-4 mr-2" />
              Mời thành viên
            </Button>
          )}
        </div>
      </div>

      {organizations.length > 1 && (
        <div className="max-w-md">
          <OrganizationSwitcher
            organizations={organizations}
            selectedOrgId={selectedOrgId}
            onSelectOrg={handleSelectOrg}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-primary mt-1" />
              <div>
                <CardTitle>{currentOrg?.name}</CardTitle>
                <CardDescription className="mt-1">
                  {currentOrg?.license_info?.address}
                </CardDescription>
              </div>
            </div>
            <OrganizationStatusBadge status={currentOrg?.kyc_status || "NOT_APPLIED"} />
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="members" className="w-full">
        <TabsList>
          <TabsTrigger value="members">Thành viên</TabsTrigger>
          <TabsTrigger value="info">Thông tin tổ chức</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Danh sách thành viên</CardTitle>
              <CardDescription>
                Quản lý các thành viên trong tổ chức
              </CardDescription>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="text-center py-4 text-muted-foreground">Đang tải...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  Chưa có thành viên nào
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Vai trò</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ngày tham gia</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{member.user?.name || "—"}</TableCell>
                        <TableCell>{member.invite_email || member.user?.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {member.role?.name && ORG_ROLE_NAMES[member.role.name as keyof typeof ORG_ROLE_NAMES]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={member.status === "ACTIVE" ? "default" : "secondary"}
                          >
                            {MEMBERSHIP_STATUSES[member.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {member.joined_at ? format(new Date(member.joined_at), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {member.role?.name && canRemoveMember(member.role.name as any) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setMemberToRemove(member.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Xóa thành viên
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin tổ chức</CardTitle>
              <CardDescription>Chi tiết giấy phép và pháp lý</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mã số thuế</p>
                  <p className="text-base">{currentOrg?.license_info?.taxId || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Giấy phép kinh doanh</p>
                  <p className="text-base">{currentOrg?.license_info?.businessLicenseNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Người đại diện</p>
                  <p className="text-base">{currentOrg?.license_info?.legalRepresentative || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Số điện thoại</p>
                  <p className="text-base">{currentOrg?.license_info?.phoneNumber || "—"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Địa chỉ</p>
                  <p className="text-base">{currentOrg?.license_info?.address || "—"}</p>
                </div>
              </div>

              {currentOrg?.rejection_reason && (
                <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-1">Lý do từ chối KYC</p>
                  <p className="text-sm">{currentOrg.rejection_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa thành viên</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa thành viên này khỏi tổ chức? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive hover:bg-destructive/90">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

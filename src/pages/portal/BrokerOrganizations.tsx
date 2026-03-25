import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserOrganizations } from "@/hooks/useOrganization";
import { useOrganizationMembers } from "@/hooks/useOrganizationMembership";
import { useUserRoleInOrg } from "@/hooks/useOrganizationRoles";
import { OrganizationStatusBadge } from "@/components/admin/OrganizationStatusBadge";
import { ORG_ROLE_NAMES } from "@/constants/organization.constants";
import { Building2, Plus, Users, ArrowRight } from "lucide-react";

export default function BrokerOrganizations() {
  const navigate = useNavigate();
  const { organizations, loading } = useUserOrganizations();

  if (loading) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý tổ chức</h1>
          <p className="text-muted-foreground">
            Xem và quản lý các tổ chức của bạn
          </p>
        </div>
        <Button onClick={() => navigate("/broker/organization/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Tạo tổ chức mới
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <OrganizationCard key={org.id} organization={org} />
        ))}
      </div>
    </div>
  );
}

function OrganizationCard({ organization }: { organization: any }) {
  const navigate = useNavigate();
  const { members } = useOrganizationMembers(organization.id);
  const { role } = useUserRoleInOrg(organization.id);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Building2 className="h-5 w-5 text-primary mt-1 shrink-0" />
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{organization.name}</CardTitle>
              <CardDescription className="mt-1 line-clamp-2">
                {organization.license_info?.address || "Chưa có địa chỉ"}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <OrganizationStatusBadge status={organization.kyc_status} />
          {role && (
            <Badge variant="secondary">
              {ORG_ROLE_NAMES[role.name as keyof typeof ORG_ROLE_NAMES]}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{members.length} thành viên</span>
        </div>

        <Button
          className="w-full"
          variant="outline"
          onClick={() => navigate(`/broker/organization?org=${organization.id}`)}
        >
          Xem chi tiết
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

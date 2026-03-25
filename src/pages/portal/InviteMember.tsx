import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInviteMember } from "@/hooks/useOrganizationMembership";
import { useOrganizationRoles } from "@/hooks/useOrganizationRoles";
import { useUserOrganizations } from "@/hooks/useOrganization";
import { useUserPermissions } from "@/hooks/useOrganizationRoles";
import { ORG_ROLE_NAMES } from "@/constants/organization.constants";
import { UserPlus } from "lucide-react";

const inviteSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  roleId: z.string().min(1, "Vui lòng chọn vai trò"),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export default function InviteMember() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("orgId");
  
  const { organizations } = useUserOrganizations();
  const { roles } = useOrganizationRoles();
  const { inviteMember, inviting } = useInviteMember();
  const { isOwner, isManager, canInvite } = useUserPermissions(orgId || organizations[0]?.id || null);

  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  });

  const selectedRoleId = watch("roleId");
  const currentOrgId = orgId || organizations[0]?.id;

  // Filter roles based on user permissions
  const availableRoles = roles.filter((role) => {
    if (isOwner) return true; // Owner can invite all roles
    if (isManager) return role.name === "Agent"; // Manager can only invite Agent
    return false;
  });

  const onSubmit = async (data: InviteFormData) => {
    if (!currentOrgId) {
      return;
    }

    const token = await inviteMember(currentOrgId, data.email, data.roleId);
    if (token) {
      setInviteToken(token);
    }
  };

  if (!currentOrgId) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Bạn chưa thuộc tổ chức nào</p>
            <Button className="mt-4" onClick={() => navigate("/broker/organization")}>
              Quay lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteToken) {
    const inviteLink = `${window.location.origin}/auth?invite=${inviteToken}`;
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Lời mời đã được tạo</CardTitle>
            <CardDescription>
              Gửi link này cho môi giới để họ đăng ký
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Link mời</Label>
              <div className="flex gap-2 mt-2">
                <Input value={inviteLink} readOnly />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                  }}
                >
                  Sao chép
                </Button>
              </div>
            </div>
            <Button onClick={() => navigate("/broker/organization")}>
              Quay về trang tổ chức
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserPlus className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Mời thành viên mới</CardTitle>
              <CardDescription>
                Gửi lời mời tham gia tổ chức
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="broker@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleId">Vai trò *</Label>
              <Select
                value={selectedRoleId}
                onValueChange={(value) => setValue("roleId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {ORG_ROLE_NAMES[role.name as keyof typeof ORG_ROLE_NAMES]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleId && (
                <p className="text-sm text-destructive">{errors.roleId.message}</p>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/broker/organization")}
                disabled={inviting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting ? "Đang xử lý..." : "Gửi lời mời"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

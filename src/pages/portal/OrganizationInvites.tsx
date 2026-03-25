import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserPendingInvites, useAcceptInvitation, useDeclineInvitation } from "@/hooks/useOrganizationMembership";
import { ORG_ROLE_NAMES } from "@/constants/organization.constants";
import { Mail, Building2, UserCheck, UserX } from "lucide-react";
import { format } from "date-fns";

export default function OrganizationInvites() {
  const { invites, loading, refetch } = useUserPendingInvites();
  const { acceptInvitation, accepting } = useAcceptInvitation();
  const { declineInvitation, declining } = useDeclineInvitation();

  const handleAccept = async (inviteId: string) => {
    const success = await acceptInvitation(inviteId);
    if (success) {
      refetch();
    }
  };

  const handleDecline = async (inviteId: string) => {
    const success = await declineInvitation(inviteId);
    if (success) {
      refetch();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Lời mời tham gia tổ chức</h1>
        <p className="text-muted-foreground">
          Quản lý các lời mời tham gia tổ chức của bạn
        </p>
      </div>

      {invites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Bạn không có lời mời nào đang chờ
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invites.map((invite) => (
            <Card key={invite.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-primary mt-1" />
                    <div>
                      <CardTitle className="text-lg">
                        {invite.organization?.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Mời bởi: {invite.inviter?.name || invite.inviter?.email}
                        {invite.created_at && (
                          <span className="ml-2">
                            • {format(new Date(invite.created_at), "dd/MM/yyyy")}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {invite.role?.name && ORG_ROLE_NAMES[invite.role.name as keyof typeof ORG_ROLE_NAMES]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAccept(invite.id)}
                    disabled={accepting || declining}
                    size="sm"
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Chấp nhận
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDecline(invite.id)}
                    disabled={accepting || declining}
                    size="sm"
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Từ chối
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

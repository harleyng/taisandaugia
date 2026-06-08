import { User, MapPin, Lock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InfoCardShell } from "@/components/shared/InfoCardShell";
import { useAuthState } from "@/hooks/useAuthState";
import { useCredits } from "@/hooks/useCredits";
import { usePaywall } from "@/contexts/PaywallContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";

const TIER_LABEL: Record<string, string> = {
  "7d": "7 ngày",
  "30d": "30 ngày",
  "1y": "1 năm",
};

interface AssetOwnerCardProps {
  name?: string | null;
  address?: string | null;
  ownerId?: string | null;
}

export const AssetOwnerCard = ({ name, address, ownerId }: AssetOwnerCardProps) => {
  const navigate = useNavigate();
  const { session } = useAuthState();
  const { ownerAccess } = useCredits();
  const { openOwnerPaywall } = usePaywall();
  const { openAuthDialog } = useAuthDialog();

  if (!name && !address && !ownerId) return null;

  const access = ownerId ? ownerAccess(ownerId) : null;
  const isUnlocked = access?.isUnlocked ?? false;
  const tier = access?.tier ?? null;

  const baseInfo = (
    <>
      {name && (
        <div className="flex items-start gap-2.5">
          <User className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Tên đơn vị</p>
            <p className="font-semibold text-foreground text-sm">{name}</p>
          </div>
        </div>
      )}
      {address && (
        <div className="flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Địa chỉ</p>
            <p className="text-foreground text-sm">{address}</p>
          </div>
        </div>
      )}
    </>
  );

  // No ownerId — simple static display
  if (!ownerId) {
    return (
      <InfoCardShell title="Thông tin người có tài sản" bodyClassName="space-y-3">
        {baseInfo}
      </InfoCardShell>
    );
  }

  // Unlocked
  if (isUnlocked) {
    return (
      <InfoCardShell title="Thông tin người có tài sản" bodyClassName="space-y-3">
        {baseInfo}
        <div className="pt-1 flex items-center justify-between">
          {tier && (
            <Badge variant="secondary" className="text-xs">
              Đang theo dõi · {TIER_LABEL[tier] ?? tier}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="ml-auto gap-1"
            onClick={() => navigate(`/asset-owner/${ownerId}`)}
          >
            Xem hồ sơ đầy đủ
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </InfoCardShell>
    );
  }

  // Locked — not logged in
  if (!session) {
    return (
      <InfoCardShell title="Thông tin người có tài sản" bodyClassName="space-y-3">
        {baseInfo}
        <div className="pt-1 border-t border-border flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground flex-1">Đăng nhập để xem lịch sử tài sản</p>
          <Button size="sm" variant="outline" onClick={() => openAuthDialog()}>
            Đăng nhập
          </Button>
        </div>
      </InfoCardShell>
    );
  }

  // Locked — logged in
  return (
    <InfoCardShell title="Thông tin người có tài sản" bodyClassName="space-y-3">
      {baseInfo}
      <div className="pt-1 border-t border-border space-y-2">
        <div className="flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Mở khóa để xem lịch sử đấu giá và hồ sơ đầy đủ của chủ tài sản
          </p>
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={() => openOwnerPaywall(ownerId, name ?? undefined)}
        >
          Mở khóa hồ sơ
        </Button>
      </div>
    </InfoCardShell>
  );
};

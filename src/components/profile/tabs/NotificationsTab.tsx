import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";

export const NotificationsTab = () => {
  const { notificationsEnabled, toggleNotifications } = useNotificationSettings();
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-5">Thông báo</h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">Nhận thông báo tài sản</p>
          <p className="text-sm text-muted-foreground mt-0.5">Nhận thông báo khi tài sản quan tâm có cập nhật</p>
        </div>
        <Switch checked={notificationsEnabled} onCheckedChange={toggleNotifications} />
      </div>
    </Card>
  );
};

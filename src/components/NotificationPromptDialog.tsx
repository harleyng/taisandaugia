import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationPromptDialog({ open, onClose }: Props) {
  const { toggleNotifications } = useNotificationSettings();

  const handleEnable = async () => {
    await toggleNotifications(true);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center">Nhận thông báo cập nhật?</DialogTitle>
          <DialogDescription className="text-center">
            Bạn sẽ được thông báo khi có thay đổi về tài sản đã quan tâm — lịch đấu giá, giá khởi điểm, trạng thái phiên.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={handleEnable} className="w-full">
            <Bell className="mr-2 h-4 w-4" />
            Bật thông báo
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
            Để sau
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

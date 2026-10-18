import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchSessionOpen } from "@/hooks/usePublicSessionPage";
import { formatShortDateTime } from "@/lib/auctionSessions/listBadge";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionTitle: string;
  opensAt: string;
  /** Email đã đăng ký trước đó (đổi địa chỉ). */
  currentEmail?: string | null;
}

/** Xác nhận địa chỉ nhận email "phiên đã mở bán hồ sơ" — gửi đúng lúc hết đếm ngược. */
export function WatchOpenDialog({ open, onOpenChange, sessionId, sessionTitle, opensAt, currentEmail }: Props) {
  const { session } = useAuth();
  const watch = useWatchSessionOpen(sessionId);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (open) setEmail(currentEmail ?? session?.user.email ?? "");
  }, [open, currentEmail, session?.user.email]);

  const valid = EMAIL_RE.test(email.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-primary" />
            Nhận email khi mở bán hồ sơ
          </DialogTitle>
          <DialogDescription>
            Chúng tôi sẽ gửi một email ngay khi phiên “{sessionTitle}” mở bán hồ sơ lúc{" "}
            <b className="text-foreground">{formatShortDateTime(opensAt)}</b>.
          </DialogDescription>
        </DialogHeader>
        <form
          id="watch-open-form"
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) watch.mutate(email.trim(), { onSuccess: () => onOpenChange(false) });
          }}
        >
          <Label htmlFor="watch-email">
            Email nhận thông báo <span className="text-destructive">*</span>
          </Label>
          <Input
            id="watch-email"
            type="email"
            value={email}
            maxLength={254}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ten@email.com"
          />
          {email && !valid && <p className="text-xs text-destructive">Email không hợp lệ.</p>}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="submit" form="watch-open-form" disabled={!valid || watch.isPending} className="gap-1.5">
            {watch.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận nhận email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

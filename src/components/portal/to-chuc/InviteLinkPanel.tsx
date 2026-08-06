import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteLink } from "@/hooks/useOrgInvites";

interface Props {
  token: string;
  expiresAt?: string | null;
  label?: string;
}

/**
 * Hiển thị liên kết mời để người mời tự copy gửi đi — dự án CHƯA có hạ tầng gửi
 * email, đây là cách giao link duy nhất (giống CreateUserDialog của admin).
 */
export function InviteLinkPanel({ token, expiresAt, label = "Liên kết tham gia" }: Props) {
  const [copied, setCopied] = useState(false);
  const url = inviteLink(token);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard bị chặn — người dùng vẫn chọn tay được vì input readonly */
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="text-xs"
        />
        <Button type="button" variant="outline" size="icon" onClick={copy} title="Sao chép">
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      {expiresAt && (
        <p className="text-xs text-muted-foreground">
          Liên kết hết hạn ngày{" "}
          {new Date(expiresAt).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
          .
        </p>
      )}
    </div>
  );
}

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUnlockShowcase } from "@/hooks/usePublicAuctionTools";

/** Ô nhập mật khẩu cho showcase bảo mật. Mở khoá đúng → trả url qua onUnlocked. */
export function ShowcaseUnlock({
  showcaseId,
  onUnlocked,
}: {
  showcaseId: string;
  onUnlocked: (url: string) => void;
}) {
  const unlock = useUnlockShowcase();
  const [password, setPassword] = useState("");

  const submit = () => {
    if (!password.trim()) return toast.error("Nhập mật khẩu");
    unlock.mutate(
      { id: showcaseId, password: password.trim() },
      {
        onSuccess: (url) => onUnlocked(url),
        onError: () => toast.error("Mật khẩu không đúng"),
      },
    );
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
        <Lock className="h-6 w-6 text-amber-600" />
      </div>
      <div>
        <p className="font-medium text-foreground">Showcase bảo mật</p>
        <p className="text-sm text-muted-foreground">Nhập mật khẩu được cấp để xem nội dung.</p>
      </div>
      <div className="flex w-full max-w-xs gap-2">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Mật khẩu"
        />
        <Button onClick={submit} disabled={unlock.isPending}>
          {unlock.isPending ? "…" : "Mở"}
        </Button>
      </div>
    </div>
  );
}

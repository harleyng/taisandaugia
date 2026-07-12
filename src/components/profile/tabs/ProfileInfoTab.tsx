import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ProfileBasicSection } from "@/components/profile/sections/ProfileBasicSection";
import { ProfileIntentSection } from "@/components/profile/sections/ProfileIntentSection";
import { DepositCard } from "@/components/company-onboarding/DepositCard";

interface Props {
  name: string;
  email: string;
  avatarUrl: string | null;
  onNameChange: (n: string) => void;
  onAvatarChange: (url: string) => void;
}

export const ProfileInfoTab = ({ name, email, avatarUrl, onNameChange, onAvatarChange }: Props) => {
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activated, setActivated] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("activated")
          .eq("id", session.user.id)
          .maybeSingle();
        setActivated(data?.activated === true);
      }
    });
  }, []);
  const initials = name ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "U";

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${session.user.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("listing-images")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Không thể tải ảnh lên");
      setUploadingAvatar(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("listing-images").getPublicUrl(path);

    const { data: profile } = await supabase
      .from("profiles")
      .select("agent_info")
      .eq("id", session.user.id)
      .single();

    const agentInfo = (profile?.agent_info as Record<string, unknown>) || {};
    await supabase
      .from("profiles")
      .update({ agent_info: { ...agentInfo, profile_picture_url: publicUrl } as never })
      .eq("id", session.user.id);

    onAvatarChange(publicUrl);
    setUploadingAvatar(false);
    toast.success("Đã cập nhật ảnh đại diện");
  };

  return (
    <div className="space-y-4">
      {/* Personal activation banner */}
      {!activated ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Zap className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Tài khoản chưa kích hoạt</p>
            <p className="text-xs text-amber-700">Nạp 1$ vào ví cá nhân để mở đầy đủ tính năng</p>
          </div>
          <Button size="sm" className="flex-shrink-0 text-xs" onClick={() => setDepositOpen(true)}>
            Kích hoạt ngay
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          <p className="text-sm font-medium text-green-800">Tài khoản đã kích hoạt</p>
        </div>
      )}

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="max-w-md p-0 border-0 bg-transparent shadow-none">
          <DepositCard
            context="personal"
            onComplete={() => { setActivated(true); setDepositOpen(false); }}
          />
        </DialogContent>
      </Dialog>

      {/* Avatar header */}
      <Card className="p-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center cursor-pointer hover:bg-muted transition-colors">
              {uploadingAvatar ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 text-muted-foreground" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
            </label>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{name || "Chưa đặt tên"}</p>
            <p className="text-sm text-muted-foreground truncate">{email}</p>
          </div>
        </div>
      </Card>

      <ProfileBasicSection initialName={name} onNameChange={onNameChange} />
      <ProfileIntentSection />
    </div>
  );
};

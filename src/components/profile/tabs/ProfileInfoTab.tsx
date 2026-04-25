import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProfileBasicSection } from "@/components/profile/sections/ProfileBasicSection";
import { ProfileIntentSection } from "@/components/profile/sections/ProfileIntentSection";

interface Props {
  name: string;
  email: string;
  avatarUrl: string | null;
  onNameChange: (n: string) => void;
  onAvatarChange: (url: string) => void;
}

export const ProfileInfoTab = ({ name, email, avatarUrl, onNameChange, onAvatarChange }: Props) => {
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  name: string;
  email: string;
  avatarUrl: string | null;
  onNameChange: (n: string) => void;
  onAvatarChange: (url: string) => void;
}

export const ProfileInfoTab = ({ name, email, avatarUrl, onNameChange, onAvatarChange }: Props) => {
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const initials = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "U";

  const handleSaveName = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("profiles").update({ name }).eq("id", session.user.id);
    setSaving(false);
    if (error) toast.error("Không thể cập nhật tên");
    else toast.success("Đã cập nhật tên");
  };

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

    const agentInfo = (profile?.agent_info as any) || {};
    await supabase
      .from("profiles")
      .update({ agent_info: { ...agentInfo, profile_picture_url: publicUrl } } as any)
      .eq("id", session.user.id);

    onAvatarChange(publicUrl);
    setUploadingAvatar(false);
    toast.success("Đã cập nhật ảnh đại diện");
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-5">Hồ sơ cá nhân</h2>
      <div className="flex items-center gap-5 mb-6">
        <div className="relative">
          <Avatar className="h-20 w-20">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="text-xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <label className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center cursor-pointer hover:bg-muted transition-colors">
            {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 text-muted-foreground" />}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
          </label>
        </div>
        <div>
          <p className="font-semibold text-foreground">{name || "Chưa đặt tên"}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="name">Tên hiển thị</Label>
        <div className="flex gap-2">
          <Input id="name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Nhập tên của bạn" />
          <Button onClick={handleSaveName} disabled={saving} size="sm" className="shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Lưu</>}
          </Button>
        </div>
      </div>
    </Card>
  );
};

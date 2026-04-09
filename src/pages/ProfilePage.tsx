import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { toast } from "sonner";
import { Camera, LogOut, Save, Loader2 } from "lucide-react";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { notificationsEnabled, toggleNotifications } = useNotificationSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/"); return; }
      setEmail(session.user.email || session.user.phone || "");

      const { data } = await supabase
        .from("profiles")
        .select("name, agent_info")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setName(data.name || "");
        const agentInfo = data.agent_info as any;
        setAvatarUrl(agentInfo?.profile_picture_url || null);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [navigate]);

  const handleSaveName = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("id", session.user.id);

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

    const { data: { publicUrl } } = supabase.storage
      .from("listing-images")
      .getPublicUrl(path);

    // Update agent_info with avatar
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

    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
    toast.success("Đã cập nhật ảnh đại diện");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) toast.error(error.message);
    else {
      toast.success("Đã đổi mật khẩu thành công");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast("Đã đăng xuất");
    navigate("/");
  };

  const initials = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "U";

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Hồ sơ cá nhân</h1>

        {/* Avatar & Name */}
        <Card className="p-6 mb-6">
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
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên của bạn" />
              <Button onClick={handleSaveName} disabled={saving} size="sm" className="shrink-0">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Lưu</>}
              </Button>
            </div>
          </div>
        </Card>

        {/* Password */}
        <Card className="p-6 mb-6">
          <h2 className="font-semibold text-foreground mb-4">Đổi mật khẩu</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-password">Mật khẩu mới</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nhập mật khẩu mới" />
            </div>
            <div>
              <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword}>
              {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Đổi mật khẩu
            </Button>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Thông báo</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Nhận thông báo khi tài sản quan tâm có cập nhật</p>
            </div>
            <Switch checked={notificationsEnabled} onCheckedChange={toggleNotifications} />
          </div>
        </Card>

        {/* Logout */}
        <Button variant="outline" onClick={handleLogout} className="w-full">
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </Button>
      </main>
      <Footer />
    </div>
  );
};

export default ProfilePage;

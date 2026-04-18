import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const PasswordTab = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

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

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-5">Đổi mật khẩu</h2>
      <div className="space-y-3 max-w-md">
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
  );
};

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { EmailOtpType } from "@supabase/supabase-js";

type Status = "loading" | "ready" | "invalid";

/**
 * Trang đích cho link "Chấp nhận lời mời" (invite) và "Đặt lại mật khẩu"
 * (recovery). Supabase redirect về đây kèm token; ta chờ session được thiết
 * lập rồi cho người dùng tạo mật khẩu. Không có trang này thì link invite rơi
 * về trang trống vì chẳng có UI nào xử lý token.
 */
const SetPassword = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let settled = false;
    const markReady = () => {
      if (settled) return;
      settled = true;
      setStatus("ready");
    };
    const markInvalid = (msg: string) => {
      if (settled) return;
      settled = true;
      setErrorMsg(msg);
      setStatus("invalid");
    };

    // Supabase trả lỗi (hết hạn/không hợp lệ) qua hash hoặc query.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const errDesc = hashParams.get("error_description") || searchParams.get("error_description");
    if (errDesc) {
      markInvalid(decodeURIComponent(errDesc.replace(/\+/g, " ")));
      return;
    }

    // Session có thể đã được detectSessionInUrl thiết lập trước khi component
    // mount — nên vừa lắng nghe onAuthStateChange, vừa chủ động getSession.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) markReady();
    });

    (async () => {
      // PKCE / OTP token nếu link dùng dạng query thay vì hash.
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      try {
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (tokenHash && type) {
          await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
        }
      } catch {
        // Bỏ qua — sẽ kiểm tra lại bằng getSession bên dưới.
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) markReady();
    })();

    // Ân hạn cho detectSessionInUrl chạy xong; sau đó vẫn không có session ⇒ link hỏng.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) markReady();
      else markInvalid("Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại lời mời.");
    }, 3000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (password !== confirm) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      toast.error(error.message || "Không thể đặt mật khẩu");
      return;
    }

    // Điều hướng theo vai trò: admin → trang quản trị, còn lại → trang chủ.
    let dest = "/";
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "ADMIN")
        .maybeSingle();
      if (role) dest = "/admin";
    }

    toast.success("Đã đặt mật khẩu thành công. Chào mừng bạn!");
    navigate(dest, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Tạo mật khẩu</CardTitle>
          <CardDescription>
            Đặt mật khẩu để kích hoạt và bắt đầu sử dụng tài khoản của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Đang xác thực liên kết…</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                Về trang đăng nhập
              </Button>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Mật khẩu mới</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">Tối thiểu 6 ký tự.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  disabled={saving}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Đặt mật khẩu &amp; tiếp tục
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SetPassword;

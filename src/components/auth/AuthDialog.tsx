import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone, Loader2 } from "lucide-react";

type Step = "identifier" | "login" | "login-phone" | "register-email" | "register-phone-otp" | "register-phone-password";
type InputMode = "email" | "phone";

export const AuthDialog = () => {
  const { isOpen, closeAuthDialog, executePendingAction } = useAuthDialog();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("identifier");
  const [inputMode, setInputMode] = useState<InputMode>("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("identifier");
        setIdentifier("");
        setPassword("");
        setConfirmPassword("");
        setOtp("");
        setLoading(false);
      }, 200);
    }
  }, [isOpen]);

  const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isPhone = (val: string) => /^0\d{9,10}$/.test(val.replace(/\s/g, ""));

  const handleIdentifierSubmit = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) return;

    const detectedMode = isEmail(trimmed) ? "email" : isPhone(trimmed) ? "phone" : null;
    if (!detectedMode) {
      toast({ title: "Vui lòng nhập email hoặc số điện thoại hợp lệ", variant: "destructive" });
      return;
    }
    setInputMode(detectedMode);
    setLoading(true);

    try {
      if (detectedMode === "email") {
        const { data, error } = await supabase.rpc("check_email_exists", { _email: trimmed });
        if (error) throw error;
        setStep(data ? "login" : "register-email");
      } else {
        // Check if phone account already exists
        const fakeEmail = `${trimmed.replace(/\s/g, "")}@phone.local`;
        const { data: exists, error: phoneErr } = await supabase.rpc("check_email_exists", { _email: fakeEmail });
        if (phoneErr) throw phoneErr;
        if (exists) {
          setStep("login-phone");
        } else {
          setStep("register-phone-otp");
        }
      }
    } catch (err: any) {
      toast({ title: "Lỗi kiểm tra tài khoản", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: identifier.trim(),
        password,
      });
      if (error) throw error;
      toast({ title: "Đăng nhập thành công!" });
      closeAuthDialog();
      setTimeout(() => executePendingAction(), 100);
    } catch (err: any) {
      toast({ title: "Đăng nhập thất bại", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterEmail = async () => {
    if (!password || password !== confirmPassword) {
      toast({ title: "Mật khẩu không khớp", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Mật khẩu phải có ít nhất 6 ký tự", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: identifier.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast({
        title: "Đăng ký thành công!",
        description: "Vui lòng kiểm tra email để xác thực tài khoản.",
      });
      closeAuthDialog();
      setTimeout(() => executePendingAction(), 100);
    } catch (err: any) {
      toast({ title: "Đăng ký thất bại", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneOtp = () => {
    if (otp === "123456") {
      setStep("register-phone-password");
    } else {
      toast({ title: "Mã OTP không đúng", variant: "destructive" });
    }
  };

  const handlePhoneRegister = async () => {
    if (!password || password !== confirmPassword) {
      toast({ title: "Mật khẩu không khớp", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Mật khẩu phải có ít nhất 6 ký tự", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Use phone number as a fake email for demo purposes
      const fakeEmail = `${identifier.trim().replace(/\s/g, "")}@phone.local`;
      const { error } = await supabase.auth.signUp({
        email: fakeEmail,
        password,
      });
      if (error) throw error;
      toast({ title: "Đăng ký thành công!" });
      closeAuthDialog();
    } catch (err: any) {
      toast({ title: "Đăng ký thất bại", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      closeAuthDialog();
    } catch (err: any) {
      toast({ title: "Đăng nhập Google thất bại", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep("identifier");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAuthDialog()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {step === "identifier" && "Đăng nhập / Đăng ký"}
            {step === "login" && "Đăng nhập"}
            {step === "register-email" && "Tạo tài khoản mới"}
            {step === "register-phone-otp" && "Xác thực OTP"}
            {step === "register-phone-password" && "Tạo mật khẩu"}
          </DialogTitle>
          <DialogDescription>
            {step === "identifier" && "Nhập email hoặc số điện thoại để tiếp tục"}
            {step === "login" && `Đăng nhập với ${identifier}`}
            {step === "register-email" && `Tạo tài khoản cho ${identifier}`}
            {step === "register-phone-otp" && `Nhập mã OTP đã gửi đến ${identifier}`}
            {step === "register-phone-password" && "Tạo mật khẩu cho tài khoản của bạn"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Step 1: Identifier */}
          {step === "identifier" && (
            <>
              <div className="space-y-2">
                <Label>Email hoặc Số điện thoại</Label>
                <Input
                  placeholder="email@example.com hoặc 0912345678"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleIdentifierSubmit()}
                  autoFocus
                />
              </div>
              <Button className="w-full" onClick={handleIdentifierSubmit} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Tiếp tục
              </Button>

              <div className="relative my-4">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
                  hoặc
                </span>
              </div>

              <Button variant="outline" className="w-full gap-2" onClick={handleGoogleLogin} disabled={loading}>
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Tiếp tục với Google
              </Button>

              <Button variant="outline" className="w-full gap-2" disabled>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Facebook (Sắp ra mắt)
              </Button>
            </>
          )}

          {/* Step 2a: Login */}
          {step === "login" && (
            <>
              <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-2" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" /> Quay lại
              </Button>
              <div className="space-y-2">
                <Label>Mật khẩu</Label>
                <Input
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  autoFocus
                />
              </div>
              <Button className="w-full" onClick={handleLogin} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Đăng nhập
              </Button>
            </>
          )}

          {/* Step 2b: Register with email */}
          {step === "register-email" && (
            <>
              <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-2" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" /> Quay lại
              </Button>
              <div className="space-y-2">
                <Label>Mật khẩu</Label>
                <Input
                  type="password"
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Xác nhận mật khẩu</Label>
                <Input
                  type="password"
                  placeholder="Nhập lại mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegisterEmail()}
                />
              </div>
              <Button className="w-full" onClick={handleRegisterEmail} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Đăng ký
              </Button>
            </>
          )}

          {/* Phone OTP step */}
          {step === "register-phone-otp" && (
            <>
              <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-2" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" /> Quay lại
              </Button>
              <div className="space-y-2">
                <Label>Mã OTP</Label>
                <Input
                  placeholder="Nhập mã 6 số"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePhoneOtp()}
                  maxLength={6}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Dùng mã 123456 để test</p>
              </div>
              <Button className="w-full" onClick={handlePhoneOtp}>
                Xác thực
              </Button>
            </>
          )}

          {/* Phone register password step */}
          {step === "register-phone-password" && (
            <>
              <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-2" onClick={() => setStep("register-phone-otp")}>
                <ArrowLeft className="h-4 w-4" /> Quay lại
              </Button>
              <div className="space-y-2">
                <Label>Mật khẩu</Label>
                <Input
                  type="password"
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Xác nhận mật khẩu</Label>
                <Input
                  type="password"
                  placeholder="Nhập lại mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePhoneRegister()}
                />
              </div>
              <Button className="w-full" onClick={handlePhoneRegister} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Đăng ký
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

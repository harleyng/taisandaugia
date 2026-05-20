import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { Building2, LogIn, UserPlus, CheckCircle2 } from "lucide-react";

interface M1AccountCreationProps {
  onAuthSuccess: () => void;
}

export const M1AccountCreation = ({ onAuthSuccess }: M1AccountCreationProps) => {
  const { openAuthDialog } = useAuthDialog();

  // Open the auth dialog immediately on mount
  useEffect(() => {
    openAuthDialog(onAuthSuccess);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Bước 1 — Tài khoản cá nhân</CardTitle>
            <CardDescription>Đăng nhập hoặc tạo tài khoản để bắt đầu</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        <div className="space-y-2">
          {[
            "Tài khoản cá nhân là nền tảng định danh của bạn trên hệ thống",
            "Bước KYC công ty sẽ gắn vai trò owner lên tài khoản này",
            "Một tài khoản cá nhân có thể đại diện nhiều công ty (sắp tới)",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => openAuthDialog(onAuthSuccess)}
          >
            <LogIn className="h-4 w-4" />
            Đăng nhập
          </Button>
          <Button
            className="gap-2"
            onClick={() => openAuthDialog(onAuthSuccess)}
          >
            <UserPlus className="h-4 w-4" />
            Tạo tài khoản
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Cửa sổ đăng nhập sẽ mở tự động.{" "}
          <button
            className="text-primary underline"
            onClick={() => openAuthDialog(onAuthSuccess)}
          >
            Bấm đây nếu không thấy.
          </button>
        </p>
      </CardContent>
    </Card>
  );
};

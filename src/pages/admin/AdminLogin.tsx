import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { qk } from "@/lib/queryKeys";

/**
 * Cổng đăng nhập RIÊNG cho khu quản trị (`/admin/login`).
 *
 * Trang public — nằm NGOÀI guard `AdminRoute` để không bị chính guard chặn.
 * Ba trạng thái:
 *  1. Chưa đăng nhập → form email + mật khẩu.
 *  2. Đã đăng nhập & là ADMIN → điều hướng tới `/admin` (hoặc `location.state.from`).
 *  3. Đã đăng nhập nhưng KHÔNG phải ADMIN → báo lỗi + nút đăng xuất đổi tài khoản.
 */
const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { session, userId, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Đích điều hướng sau khi xác thực admin thành công (do AdminRoute truyền vào).
  // Giữ cả search + hash: nhiều trang admin (vd. khách hàng tiềm năng) đặt bộ lọc
  // trên URL, mất query string là người dùng quay lại một trang khác trang họ mở.
  const target = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  const from = target?.pathname ? `${target.pathname}${target.search ?? ""}${target.hash ?? ""}` : "/admin";

  // Cùng queryKey với AdminRoute → tận dụng cache, không gọi thừa.
  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: qk.isAdmin(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "ADMIN")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  // Đã là admin → rời trang login.
  useEffect(() => {
    if (session && isAdmin) {
      navigate(from, { replace: true });
    }
  }, [session, isAdmin, from, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Điều hướng do effect ở trên xử lý sau khi role được kiểm tra.
    } catch (error) {
      toast({
        title: "Lỗi đăng nhập",
        description: error instanceof Error ? error.message : "Vui lòng kiểm tra email và mật khẩu",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setEmail("");
    setPassword("");
    toast({ title: "Đã đăng xuất" });
  };

  // Đang khôi phục phiên / đang kiểm tra role → spinner.
  if (authLoading || (session && roleLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Đã đăng nhập nhưng KHÔNG phải admin → báo lỗi tại trang.
  if (session && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <ShieldAlert className="h-6 w-6 text-warning" />
            </div>
            <CardTitle className="text-xl font-bold">Không có quyền quản trị</CardTitle>
            <CardDescription>
              Tài khoản này không có quyền truy cập khu quản trị. Vui lòng đăng xuất và đăng nhập
              bằng tài khoản quản trị.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={handleSignOut}>
              Đăng xuất & đổi tài khoản
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Chưa đăng nhập → form đăng nhập.
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Quản trị · Tài Sản Đấu Giá</CardTitle>
          <CardDescription>Đăng nhập bằng tài khoản quản trị</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Mật khẩu</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đăng nhập
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;

import { useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Gavel, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { AUCTION_LINKS, auctionUrl } from "@/lib/auctionPlatform";

/** `state` do sàn sinh (base64url / hex, 32–128 ký tự) — khớp kiểm tra của edge fn. */
const STATE_RE = /^[A-Za-z0-9_-]{32,128}$/;

/** Tài khoản SĐT dùng email giả `0912…@phone.local` — hiển thị lại số điện thoại. */
const identityLabel = (email: string | null | undefined) =>
  email?.endsWith("@phone.local") ? email.slice(0, -"@phone.local".length) : (email ?? "");

/**
 * /dang-nhap/san-dau-gia?state=… — bước giữa của "Đăng nhập bằng tài khoản Tài Sản
 * Đấu Giá" trên Sàn đấu giá trực tuyến (edge fn `auth-handoff`, plan 4.3). Người dùng
 * xác nhận tài khoản ⇒ xin mã một lần ⇒ chuyển về sàn với mã trong fragment.
 * Đích chuyển về là tên miền sàn cố định trong env — không lấy từ tham số URL.
 */
export default function AuctionLoginHandoff() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = params.get("state") ?? "";
  const target = auctionUrl(AUCTION_LINKS.authHandoff);
  const backToAuction = auctionUrl(AUCTION_LINKS.auth);
  const { session, loading } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proceed = async () => {
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke<{ code?: string }>("auth-handoff", {
      body: { action: "create", state },
    });
    if (fnError || !data?.code) {
      setError("Không tạo được liên kết đăng nhập. Vui lòng thử lại.");
      setBusy(false);
      return;
    }
    window.location.replace(`${target}#code=${encodeURIComponent(data.code)}`);
  };

  const switchAccount = async () => {
    await supabase.auth.signOut();
    openAuthDialog();
  };

  let body: ReactNode;
  if (!STATE_RE.test(state)) {
    body = (
      <>
        <h1 className="text-lg font-semibold text-foreground">Liên kết đăng nhập không hợp lệ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vui lòng quay lại Sàn đấu giá trực tuyến và bấm lại “Đăng nhập bằng tài khoản Tài Sản Đấu Giá”.
        </p>
        <Button variant="outline" className="mt-5 w-full" onClick={() => navigate("/")}>
          Về trang chủ
        </Button>
      </>
    );
  } else if (loading) {
    body = <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />;
  } else if (!session) {
    body = (
      <>
        <h1 className="text-lg font-semibold text-foreground">Đăng nhập vào Sàn đấu giá trực tuyến</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Đăng nhập Tài Sản Đấu Giá để vào sàn bằng chính tài khoản này.
        </p>
        <Button className="mt-5 w-full" onClick={() => openAuthDialog()}>
          Đăng nhập Tài Sản Đấu Giá
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => window.location.assign(backToAuction)}>
          Quay lại Sàn đấu giá
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-lg font-semibold text-foreground">Tiếp tục vào Sàn đấu giá trực tuyến</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bạn sẽ đăng nhập sàn bằng tài khoản{" "}
          <span className="font-medium text-foreground">{identityLabel(session.user.email)}</span>.
        </p>
        <Button className="mt-5 w-full" onClick={proceed} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Tiếp tục
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={switchAccount} disabled={busy}>
          Dùng tài khoản khác
        </Button>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <p className="mt-4 text-xs leading-snug text-muted-foreground">
          Sàn đấu giá trực tuyến có Điều khoản sử dụng và Chính sách bảo mật riêng, hiển thị khi bạn vào sàn.
        </p>
      </>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Gavel className="h-5 w-5" />
        </div>
        {body}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Building2, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useAcceptInvite, useInvitePreview } from "@/hooks/useOrgInvites";
import { DepositCard } from "@/components/company-onboarding/DepositCard";
import type { AcceptInviteResult } from "@/types/orgRbac";

/**
 * Trang chấp nhận lời mời vào tổ chức: /loi-moi/:token
 *
 * Đứng NGOÀI /portal (người dùng chưa phải thành viên) và không dùng OrgContext —
 * mọi thứ đi qua RPC get_org_invite_preview / accept_org_invite.
 *
 * Cổng kích hoạt được thực thi ở SERVER (accept_org_invite trả reason
 * 'not_activated'); phần UI dưới đây chỉ dẫn người dùng đi kích hoạt.
 */
export default function InviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const { data: preview, isLoading, refetch } = useInvitePreview(token);
  const accept = useAcceptInvite();

  const [result, setResult] = useState<AcceptInviteResult | null>(null);

  const tryAccept = async (confirmEmailMismatch = false) => {
    if (!token) return;
    try {
      const res = await accept.mutateAsync({ token, confirmEmailMismatch });
      setResult(res);
      if (res.ok) {
        toast.success(`Đã tham gia ${preview?.org_name ?? "tổ chức"}`);
        navigate("/portal/dashboard", { replace: true });
      }
    } catch (err) {
      toast.error("Không tham gia được", { description: (err as Error).message });
    }
  };

  // Đã đăng nhập + lời mời hợp lệ → thử chấp nhận ngay một lần.
  useEffect(() => {
    if (authLoading || isLoading) return;
    if (!session || !preview?.ok || preview.claimed || preview.expired) return;
    if (result || accept.isPending) return;
    void tryAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoading, session, preview]);

  if (isLoading || authLoading) {
    return (
      <Shell>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      </Shell>
    );
  }

  // ─── Lời mời không dùng được ─────────────────────────────────────────────
  if (!preview?.ok || preview.claimed || preview.expired) {
    const reason = !preview?.ok
      ? "Lời mời không tồn tại hoặc đã bị thu hồi."
      : preview.claimed
        ? "Lời mời này đã được sử dụng."
        : "Lời mời này đã hết hạn. Hãy liên hệ tổ chức để được gửi liên kết mới.";
    return (
      <Shell>
        <Icon tone="destructive" />
        <h1 className="text-lg font-semibold text-foreground">Lời mời không hợp lệ</h1>
        <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
        <Button className="mt-6 w-full" onClick={() => navigate("/")}>
          Về trang chủ
        </Button>
      </Shell>
    );
  }

  const orgName = preview.org_name ?? "tổ chức";
  const roleName = preview.role_name ?? "thành viên";

  // ─── Chưa đăng nhập ──────────────────────────────────────────────────────
  if (!session) {
    return (
      <Shell>
        <Icon />
        <h1 className="text-lg font-semibold text-foreground">
          Bạn được mời vào {orgName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vai trò: <strong className="text-foreground">{roleName}</strong>
          {preview.invite_email && (
            <>
              <br />
              Lời mời gửi tới {preview.invite_email}
            </>
          )}
        </p>
        <Button className="mt-6 w-full" onClick={() => openAuthDialog(() => void tryAccept())}>
          Đăng nhập để tham gia
        </Button>
      </Shell>
    );
  }

  // ─── Chưa kích hoạt: chặn cứng, dẫn đi kích hoạt ─────────────────────────
  if (result?.reason === "not_activated") {
    return (
      <Shell wide>
        <h1 className="text-lg font-semibold text-foreground">
          Bạn cần kích hoạt tài khoản trước khi tham gia tổ chức
        </h1>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">
          Sau khi kích hoạt, bạn sẽ tự động được thêm vào{" "}
          <strong className="text-foreground">{orgName}</strong> với vai trò {roleName}.
        </p>
        <DepositCard
          context="personal"
          onComplete={async () => {
            await refetch();
            setResult(null);
            void tryAccept();
          }}
        />
      </Shell>
    );
  }

  // ─── Email đăng nhập khác email được mời ─────────────────────────────────
  if (result?.reason === "email_mismatch") {
    return (
      <Shell>
        <Icon tone="warning" />
        <h1 className="text-lg font-semibold text-foreground">Email không khớp</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Lời mời được gửi tới <strong className="text-foreground">{result.invite_email}</strong>,
          nhưng bạn đang đăng nhập bằng tài khoản khác.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => void tryAccept(true)} disabled={accept.isPending}>
            {accept.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Tiếp tục với tài khoản này
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              setResult(null);
            }}
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Đăng xuất và đổi tài khoản
          </Button>
        </div>
      </Shell>
    );
  }

  // ─── Tài khoản bị khóa ───────────────────────────────────────────────────
  if (result?.reason === "locked") {
    return (
      <Shell>
        <Icon tone="destructive" />
        <h1 className="text-lg font-semibold text-foreground">Tài khoản đang bị khóa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bạn không thể tham gia tổ chức khi tài khoản đang bị khóa. Vui lòng liên hệ bộ phận
          hỗ trợ.
        </p>
        <Button className="mt-6 w-full" variant="outline" onClick={() => navigate("/")}>
          Về trang chủ
        </Button>
      </Shell>
    );
  }

  // ─── Đã là thành viên ────────────────────────────────────────────────────
  if (result?.reason === "already_member") {
    return (
      <Shell>
        <Icon />
        <h1 className="text-lg font-semibold text-foreground">Bạn đã là thành viên</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tài khoản của bạn đã có mặt trong {orgName}.
        </p>
        <Button className="mt-6 w-full" onClick={() => navigate("/portal/dashboard")}>
          Vào portal tổ chức
        </Button>
      </Shell>
    );
  }

  // ─── Các lỗi còn lại + trạng thái đang xử lý ─────────────────────────────
  if (result && !result.ok) {
    return (
      <Shell>
        <Icon tone="destructive" />
        <h1 className="text-lg font-semibold text-foreground">Không tham gia được</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Lời mời không còn hiệu lực. Hãy liên hệ tổ chức để được gửi liên kết mới.
        </p>
        <Button className="mt-6 w-full" onClick={() => navigate("/")}>
          Về trang chủ
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">Đang thêm bạn vào {orgName}…</p>
    </Shell>
  );
}

// ─── Khung trang ───────────────────────────────────────────────────────────
function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div
        className={[
          "w-full text-center",
          wide ? "max-w-lg" : "max-w-md rounded-2xl border border-border bg-card p-8",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

function Icon({ tone }: { tone?: "destructive" | "warning" }) {
  const cls =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : "bg-muted text-muted-foreground";
  const Glyph = tone ? AlertCircle : Building2;
  return (
    <div
      className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${cls}`}
    >
      <Glyph className="h-6 w-6" />
    </div>
  );
}

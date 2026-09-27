import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { DepositCard } from "@/components/company-onboarding/DepositCard";
import { InviteIcon, InviteShell } from "@/components/invites/InviteShell";
import {
  useAcceptOwnerInvite,
  useOwnerInvitePreview,
  type OwnerAcceptResult,
} from "@/hooks/useOwnerInviteAccept";
import { ownerWsErrorMessage, ownerWsReasonMessage } from "@/lib/ownerWorkspace/errors";

/**
 * Chấp nhận lời mời vào không gian chủ tài sản: /loi-moi-chu-tai-san/:token
 *
 * Tách khỏi /loi-moi/:token của tổ chức đấu giá (token không mang loại lời mời;
 * trang kia gắn chặt RPC, câu chữ và điều hướng của tổ chức). Mọi luật nằm ở
 * server (owner_ws_accept_invite): email phải KHỚP CỨNG email được mời, tài
 * khoản phải đã kích hoạt; trang này chỉ dẫn người dùng qua từng trường hợp.
 */
export default function OwnerInviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const { data: preview, isLoading, isError, refetch } = useOwnerInvitePreview(token);
  const accept = useAcceptOwnerInvite();
  const [result, setResult] = useState<OwnerAcceptResult | null>(null);

  const workspaceName = preview?.workspace_name ?? "không gian";
  const roleLabel = preview?.role_name || "Thành viên";
  // Lời mời mình đã dùng vẫn "dùng được": server trả ok ⇒ đưa thẳng vào cổng.
  const usable =
    !!preview?.ok && !preview.expired && !preview.revoked && (!preview.accepted || !!preview.accepted_by_me);

  const tryAccept = async () => {
    if (!token) return;
    try {
      const { result: res } = await accept.mutateAsync(token);
      setResult(res);
      if (res.ok) {
        toast.success(`Đã tham gia ${workspaceName}`);
        navigate("/chu-tai-san/dashboard", { replace: true });
      }
    } catch (err) {
      toast.error("Không tham gia được", { description: ownerWsErrorMessage(err) });
    }
  };

  // Đã đăng nhập + lời mời dùng được → thử chấp nhận ngay một lần.
  useEffect(() => {
    if (authLoading || isLoading) return;
    if (!session || !usable) return;
    if (result || accept.isPending) return;
    void tryAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoading, session, usable]);

  if (isLoading || authLoading) {
    return (
      <InviteShell>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      </InviteShell>
    );
  }

  if (isError) {
    return (
      <InviteShell>
        <InviteIcon tone="destructive" />
        <h1 className="text-lg font-semibold text-foreground">Chưa tải được lời mời</h1>
        <p className="mt-2 text-sm text-muted-foreground">Kiểm tra kết nối mạng rồi thử lại.</p>
        <Button className="mt-6 w-full" onClick={() => void refetch()}>
          Thử lại
        </Button>
      </InviteShell>
    );
  }

  // ─── Lời mời không dùng được ─────────────────────────────────────────────
  if (!usable) {
    const reason = !preview?.ok
      ? "Lời mời không tồn tại hoặc liên kết bị sai."
      : preview.revoked
        ? "Lời mời đã bị thu hồi. Hãy liên hệ Trưởng đơn vị để được gửi liên kết mới."
        : preview.accepted
          ? "Lời mời này đã được sử dụng."
          : "Lời mời đã hết hạn. Hãy liên hệ Trưởng đơn vị để được gửi liên kết mới.";
    return (
      <InviteShell>
        <InviteIcon tone="destructive" />
        <h1 className="text-lg font-semibold text-foreground">Lời mời không còn hiệu lực</h1>
        <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
        <Button className="mt-6 w-full" onClick={() => navigate("/")}>
          Về trang chủ
        </Button>
      </InviteShell>
    );
  }

  // ─── Chưa đăng nhập ──────────────────────────────────────────────────────
  if (!session) {
    return (
      <InviteShell>
        <InviteIcon glyph={Users} />
        <h1 className="text-lg font-semibold text-foreground">Bạn được mời vào {workspaceName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vai trò: <strong className="text-foreground">{roleLabel}</strong>
          {preview?.invite_email && (
            <>
              <br />
              Đăng nhập hoặc đăng ký bằng đúng email{" "}
              <strong className="text-foreground">{preview.invite_email}</strong>
            </>
          )}
        </p>
        <Button className="mt-6 w-full" onClick={() => openAuthDialog()}>
          Đăng nhập để tham gia
        </Button>
      </InviteShell>
    );
  }

  const failure = result?.ok === false ? result : null;

  // ─── Chưa kích hoạt: chặn cứng, dẫn đi kích hoạt ─────────────────────────
  if (failure?.reason === "not_activated") {
    return (
      <InviteShell wide>
        <h1 className="text-lg font-semibold text-foreground">
          Bạn cần kích hoạt tài khoản trước khi tham gia
        </h1>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">
          Sau khi kích hoạt, bạn sẽ tự động được thêm vào{" "}
          <strong className="text-foreground">{workspaceName}</strong> với vai trò {roleLabel}.
        </p>
        <DepositCard
          context="personal"
          onComplete={async () => {
            setResult(null);
            await tryAccept();
          }}
        />
      </InviteShell>
    );
  }

  // ─── Email đăng nhập khác email được mời: chặn cứng ──────────────────────
  if (failure?.reason === "email_mismatch") {
    return (
      <InviteShell>
        <InviteIcon tone="warning" />
        <h1 className="text-lg font-semibold text-foreground">Email không khớp</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Lời mời được gửi tới{" "}
          <strong className="text-foreground">{failure.invite_email ?? preview?.invite_email}</strong>. Hãy
          đăng nhập bằng đúng email đó để tham gia.
        </p>
        <Button
          className="mt-6 w-full"
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            setResult(null);
          }}
        >
          <LogOut className="mr-1.5 h-4 w-4" />
          Đăng xuất và đổi tài khoản
        </Button>
      </InviteShell>
    );
  }

  // ─── Các lỗi còn lại (khoá, thu hồi, hết hạn giữa chừng…) ────────────────
  if (failure) {
    return (
      <InviteShell>
        <InviteIcon tone="destructive" />
        <h1 className="text-lg font-semibold text-foreground">Không tham gia được</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ownerWsReasonMessage(failure.reason)}
          {failure.reason !== "locked" && " Hãy liên hệ Trưởng đơn vị để được gửi liên kết mới."}
        </p>
        <Button className="mt-6 w-full" variant="outline" onClick={() => navigate("/")}>
          Về trang chủ
        </Button>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">Đang thêm bạn vào {workspaceName}…</p>
    </InviteShell>
  );
}

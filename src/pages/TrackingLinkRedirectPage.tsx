import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Link2Off, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { useResolveLegacyLink } from "@/hooks/useOwnerMarketingLinks";
import { BRAND } from "@/lib/brand";
import { isTrackingCode } from "@/lib/ownerMarketing/links";
import { sharedPostingPath } from "@/lib/postingShare/message";

/**
 * Link theo dõi /l/:code CŨ (Phase M1) — đã gửi qua Zalo / SMS / app trước khi mọi link thành
 * Hồ sơ online. Tra mã mới rồi chuyển sang /hs/:code; lượt mở + cookie ghi nhận nguồn do trang
 * Hồ sơ online lo (cùng id link nên số liệu cũ và mới nối liền).
 */
const TrackingLinkRedirectPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const valid = isTrackingCode(code);
  const { data, isError, refetch, isFetching } = useResolveLegacyLink(code);

  // Link chỉ là đường dẫn trung gian: không cho máy tìm kiếm lập chỉ mục.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (data?.ok !== true) return;
    navigate(sharedPostingPath(data.code), { replace: true });
  }, [data, navigate]);

  const notFound = !valid || data?.ok === false;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="border-b">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-3">
          <img src={logo} alt={BRAND.name} className="h-7 w-auto" />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12">
        {notFound ? (
          <EmptyState
            icon={Link2Off}
            tone="muted"
            className="w-full"
            title="Link không còn hiệu lực"
            description="Link này đã bị gỡ hoặc gõ chưa đúng. Bạn vẫn có thể xem các tài sản đang đấu giá trên sàn."
            action={<Button onClick={() => navigate("/listings")}>Xem tài sản đang đấu giá</Button>}
          />
        ) : isError ? (
          <EmptyState
            icon={AlertCircle}
            tone="destructive"
            className="w-full"
            title="Chưa mở được tài sản"
            description="Kết nối mạng có thể đang chập chờn. Vui lòng thử lại."
            action={
              <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>
                Thử lại
              </Button>
            }
          />
        ) : (
          <div className="flex w-full flex-col items-center gap-3 text-center" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-primary" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Đang mở tài sản…</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default TrackingLinkRedirectPage;

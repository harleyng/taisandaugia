import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { auctionUrl } from "@/lib/auctionPlatform";

/**
 * Route giữ chỗ cho màn đã chuyển sang Sàn đấu giá trực tuyến (Phase 5): link nội bộ
 * còn trỏ đường dẫn cũ (dòng hợp đồng, nhật ký, bookmark) ⇒ thay trang bằng cùng
 * đường dẫn + query + hash trên sàn. `replace` để nút Back về lại trang trước đó,
 * không kẹt ở trang chuyển hướng. Tải trực tiếp đã được vercel.json chuyển ở server.
 */
export function AuctionRedirect({ mapPath }: { mapPath?: (pathname: string) => string }) {
  const { pathname, search, hash } = useLocation();
  const target = auctionUrl(`${mapPath ? mapPath(pathname) : pathname}${search}${hash}`);

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Đang chuyển sang Sàn đấu giá trực tuyến…</p>
      <a href={target} className="text-sm font-medium text-primary hover:underline">
        Bấm vào đây nếu trình duyệt không tự chuyển
      </a>
    </div>
  );
}

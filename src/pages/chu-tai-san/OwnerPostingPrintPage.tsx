import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostingPrintSheet } from "@/components/asset-posting/print/PostingPrintSheet";
import { PRINT_FONTS_HREF } from "@/components/asset-posting/print/postingPrintCss";
import { usePostingPrintData } from "@/hooks/usePostingPrintData";
import { OWNER_POSTINGS_PATH, ownerPostingPath } from "@/lib/asset-posting/paths";

/** Font của thiết kế (Be Vietnam Pro + IBM Plex Mono) — chỉ nạp ở trang in. */
function usePrintFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = PRINT_FONTS_HREF;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}

/** Chờ font + mọi ảnh trong tài liệu tải xong (ảnh lỗi cũng tính là xong). */
async function waitForAssets(root: HTMLElement) {
  await document.fonts?.ready;
  await Promise.all(
    Array.from(root.querySelectorAll("img"))
      .filter((img) => !img.complete)
      .map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
  );
}

/**
 * Trang in / lưu PDF một hồ sơ số hoá — /chu-tai-san/dang-tai-san/:id/in.
 * Ngoài OwnerPortalLayout (không sidebar / topbar), vẫn sau ProtectedRoute.
 * `?auto=1` ⇒ tự mở hộp thoại in khi dữ liệu, font và ảnh đã sẵn sàng.
 */
const OwnerPostingPrintPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, isLoading } = usePostingPrintData(id);
  const [exportedAt] = useState(() => new Date());
  const sheetRef = useRef<HTMLDivElement>(null);
  const printed = useRef(false);
  usePrintFonts();

  useEffect(() => {
    if (!data) return;
    const previous = document.title;
    // Tên tệp PDF mặc định lấy từ tiêu đề trang.
    document.title = `Hồ sơ ${data.posting.code} — ${data.posting.title}`;
    return () => {
      document.title = previous;
    };
  }, [data]);

  useEffect(() => {
    if (isLoading || !data || printed.current || params.get("auto") !== "1" || !sheetRef.current) return;
    printed.current = true;
    let cancelled = false;
    waitForAssets(sheetRef.current).then(() => {
      if (!cancelled) window.setTimeout(() => window.print(), 200);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoading, data, params]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-base font-semibold text-foreground">Không mở được hồ sơ để in.</p>
        <Button variant="outline" onClick={() => navigate(OWNER_POSTINGS_PATH)}>
          Về danh sách hồ sơ
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-4 py-3 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() => navigate(ownerPostingPath(data.posting.id))}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Về hồ sơ
        </Button>
        <Button className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" strokeWidth={1.5} />
          In / Lưu PDF
        </Button>
      </div>
      <div ref={sheetRef}>
        <PostingPrintSheet data={data} exportedAt={exportedAt} />
      </div>
    </div>
  );
};

export default OwnerPostingPrintPage;

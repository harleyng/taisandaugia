import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedPostingPrintSheet } from "@/components/asset-posting/shared/SharedPostingPrintSheet";
import { PRINT_FONTS_HREF } from "@/components/asset-posting/print/postingPrintCss";
import { useSharedPosting } from "@/hooks/useSharedPosting";
import { sharedPostingPath, sharedPostingUrl } from "@/lib/postingShare/message";
import { SHARED_POSTING_UNAVAILABLE } from "@/lib/postingShare/status";

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
 * Bản in / lưu PDF của Hồ sơ online — /hs/:code/in. Công khai như trang chính; KHÔNG tính
 * lượt xem (nút "Tải PDF" đã ghi sự kiện cta_pdf). `?auto=1` ⇒ tự mở hộp thoại in.
 */
const SharedPostingPrintPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, isLoading } = useSharedPosting(code, false);
  const [printedAt] = useState(() => new Date());
  const sheetRef = useRef<HTMLDivElement>(null);
  const printed = useRef(false);
  const posting = data?.ok === true ? data.posting : null;

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = PRINT_FONTS_HREF;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.append(link, meta);
    return () => {
      link.remove();
      meta.remove();
    };
  }, []);

  useEffect(() => {
    if (!posting) return;
    const previous = document.title;
    // Tên tệp PDF mặc định lấy từ tiêu đề trang.
    document.title = `Hồ sơ tài sản — ${posting.title}`;
    return () => {
      document.title = previous;
    };
  }, [posting]);

  useEffect(() => {
    if (!posting || printed.current || params.get("auto") !== "1" || !sheetRef.current) return;
    printed.current = true;
    let cancelled = false;
    waitForAssets(sheetRef.current).then(() => {
      if (!cancelled) window.setTimeout(() => window.print(), 200);
    });
    return () => {
      cancelled = true;
    };
  }, [posting, params]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!posting || !code) {
    const msg = data?.ok === false ? SHARED_POSTING_UNAVAILABLE[data.reason] : null;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
        <p className="text-base font-semibold text-foreground">{msg?.title ?? "Không mở được hồ sơ để in."}</p>
        {msg && <p className="max-w-md text-sm text-muted-foreground">{msg.description}</p>}
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
          onClick={() => navigate(sharedPostingPath(code))}
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
        <SharedPostingPrintSheet posting={posting} url={sharedPostingUrl(code)} printedAt={printedAt} />
      </div>
    </div>
  );
};

export default SharedPostingPrintPage;

import type { ReactNode } from "react";
import { AlertCircle, Building2, type LucideIcon } from "lucide-react";

/**
 * Khung trang chấp nhận lời mời — dùng chung cho lời mời vào tổ chức đấu giá
 * (/loi-moi/:token) và vào không gian chủ tài sản (/loi-moi-chu-tai-san/:token).
 */
export function InviteShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
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

/** Icon tròn đầu thẻ; có tone ⇒ biểu tượng cảnh báo, không có ⇒ `glyph` (mặc định toà nhà). */
export function InviteIcon({
  tone,
  glyph = Building2,
}: {
  tone?: "destructive" | "warning";
  glyph?: LucideIcon;
}) {
  const cls =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : "bg-muted text-muted-foreground";
  const Glyph = tone ? AlertCircle : glyph;
  return (
    <div
      className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${cls}`}
    >
      <Glyph className="h-6 w-6" />
    </div>
  );
}

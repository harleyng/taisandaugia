import type { ReactNode } from "react";

interface ServiceBannerProps {
  icon: ReactNode;
  title: string;
  /** Mô tả dịch vụ khi chưa có yêu cầu nào. */
  desc: string;
  /** Có yêu cầu / kết quả ⇒ thay mô tả bằng dòng trạng thái và đổi nền banner sang trắng. */
  status?: { text: string; tone: "warn" | "ok" } | null;
  /** Nhãn cạnh tiêu đề, vd "Bắt buộc". */
  badge?: ReactNode;
  /** Nút hành động bên phải (CTA gửi yêu cầu…). */
  action?: ReactNode;
  /** Chi tiết yêu cầu đang chạy / kết quả — hiện dưới hàng banner. */
  children?: ReactNode;
}

/**
 * Banner dịch vụ đầu bước của wizard số hoá (thiết kế "So Hoa Tai San v3"):
 * Tư vấn pháp lý (bước 3), Tư vấn đấu giá + Thẩm định (bước 4).
 * Chưa có yêu cầu: nền primary nhạt + CTA. Đã có: nền trắng, dòng trạng thái,
 * chi tiết đơn/kết quả xổ ngay bên dưới để thao tác tiếp (thanh toán, xem đề xuất…).
 */
export function ServiceBanner({ icon, title, desc, status, badge, action, children }: ServiceBannerProps) {
  const on = !!status;
  return (
    <div className={`rounded-xl border ${on ? "border-border bg-card" : "border-primary/20 bg-primary/5"}`}>
      <div className="flex flex-wrap items-center gap-3.5 px-[18px] py-3.5 sm:flex-nowrap">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-card text-primary [&_svg]:h-[18px] [&_svg]:w-[18px]">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col leading-snug">
          <span className="flex items-center gap-2 text-[14.5px] font-bold text-foreground">
            {title}
            {badge}
          </span>
          {status ? (
            <span className={`text-[13px] font-semibold ${status.tone === "ok" ? "text-success" : "text-warning"}`}>
              {status.text}
            </span>
          ) : (
            <span className="text-[13px] text-muted-foreground">{desc}</span>
          )}
        </div>
        {action}
      </div>
      {children && <div className="space-y-3 border-t border-border px-[18px] py-3.5">{children}</div>}
    </div>
  );
}

/** Nút CTA của banner — nút primary cỡ nhỏ (34px) như `.v3-b.pri.sm`. */
export function ServiceBannerButton({
  onClick,
  children,
  quiet,
}: {
  onClick: () => void;
  children: ReactNode;
  /** Nút phụ (nền trong suốt) — dùng khi đã có kết quả, vd "Rà soát lại". */
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        quiet
          ? "inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-2.5 text-[13px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          : "inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90"
      }
    >
      {children}
    </button>
  );
}

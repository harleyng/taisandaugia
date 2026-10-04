import { Check, Minus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PostingShareLink } from "@/lib/postingShare/types";

function Setting({ on, label, help }: { on: boolean; label: string; help: string }) {
  const Icon = on ? Check : Minus;
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={
          on
            ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"
            : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        }
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0 text-sm">
        <span className="font-medium text-foreground">
          {label}: {on ? "bật" : "tắt"}
        </span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
    </li>
  );
}

interface ShareLinkSettingsCardProps {
  link: PostingShareLink;
  /** Có ⇒ hiện nút sửa (người quản lý được link, link chưa thu hồi). */
  onEdit?: () => void;
}

/** Tab "Cài đặt link": người nhận thấy gì khi mở link. */
export function ShareLinkSettingsCard({ link, onEdit }: ShareLinkSettingsCardProps) {
  const listing = link.targetKind === "listing";
  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Người nhận thấy gì</h2>
        {onEdit && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
            <Pencil className="h-4 w-4" strokeWidth={1.5} />
            Sửa cài đặt
          </Button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-border">
        <Setting
          on={listing || link.showPrice}
          label="Giá khởi điểm"
          help={
            listing
              ? "Tin đã công khai giá trên sàn — luôn hiện."
              : "Khi tài sản đã có phiên công bố, giá luôn hiện theo thông báo đấu giá."
          }
        />
        <Setting on={link.showExactAddress} label="Địa chỉ chính xác" help="Tắt: khách chỉ thấy quận / huyện, tỉnh / thành." />
        <Setting
          on={link.showSenderContact}
          label="Liên hệ người gửi"
          help={link.senderName ? `Khách thấy tên ${link.senderName} và nút “Gọi”.` : "Chưa chọn người gửi."}
        />
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Giấy tờ pháp lý gốc, thù lao và ghi chú nội bộ không bao giờ hiện trên Hồ sơ online.
        {listing && " Với tin trên sàn: không hiện mô tả tự do — chỉ thông tin đã công khai trên trang tin."}
      </p>
    </section>
  );
}

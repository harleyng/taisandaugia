import { FileDown, Phone, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { heroPriceParts, type SessionCta } from "@/lib/postingShare/view";
import { SharedFollowButton, type FollowState } from "./SharedFollowButton";

interface SharedCtaBarProps {
  cta: SessionCta;
  price: number | null;
  phone: string | null;
  follow: FollowState;
  onBuyDossier: () => void;
  onFollow: () => void;
  onCall: () => void;
  onPdf: () => void;
  /** Tin trên sàn: nút phụ là "Lưu tài sản". */
  save?: boolean;
}

const ICON_BTN =
  "grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl border border-border bg-background text-foreground";

/** Thanh hành động dính đáy màn hình trên điện thoại (Zalo in-app browser) — ẩn từ sm. */
export function SharedCtaBar({ cta, price, phone, follow, onBuyDossier, onFollow, onCall, onPdf, save = false }: SharedCtaBarProps) {
  const short = price ? heroPriceParts(price) : null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-border bg-background/95 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2.5 backdrop-blur sm:hidden print:hidden">
      <div className="min-w-0 flex-1">
        <small className="block text-[11.5px] text-muted-foreground">Giá khởi điểm</small>
        <b className="text-[17px] font-bold tabular-nums text-foreground">{short ? `${short.value} ${short.unit}` : "Liên hệ"}</b>
      </div>
      {phone && (
        <a href={`tel:${phone}`} onClick={onCall} aria-label={`Gọi ${phone}`} className={ICON_BTN}>
          <Phone className="h-[15px] w-[15px]" strokeWidth={1.8} />
        </a>
      )}
      <button type="button" onClick={onPdf} aria-label="Tải PDF" className={ICON_BTN}>
        <FileDown className="h-[15px] w-[15px]" strokeWidth={1.8} />
      </button>
      {cta === "dossier" ? (
        <Button onClick={onBuyDossier} className="h-[46px] gap-2 rounded-[10px] px-4 font-semibold">
          <ShoppingBag className="h-[15px] w-[15px]" strokeWidth={1.8} />
          Mua hồ sơ
        </Button>
      ) : (
        <SharedFollowButton state={follow} onFollow={onFollow} compact save={save} />
      )}
    </div>
  );
}

import type { AnchorHTMLAttributes } from "react";
import { auctionUrl } from "@/lib/auctionPlatform";

interface AuctionLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** Đường dẫn trên sàn đấu giá, vd. AUCTION_LINKS.sessions. */
  to: string;
}

/** Link sang sàn đấu giá trực tuyến (tên miền riêng ⇒ `<a href>`, không dùng router). */
export function AuctionLink({ to, children, ...rest }: AuctionLinkProps) {
  return (
    <a href={auctionUrl(to)} {...rest}>
      {children}
    </a>
  );
}

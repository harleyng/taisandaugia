import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { shortLinkBase } from "@/lib/brand";
import { ADMIN_MKT_ORDER_PATH } from "@/lib/ownerMarketing/orders";
import { buildAdPrefill, buildEmailPrefill } from "@/lib/ownerMarketing/fulfilment";
import type { ListingAddress, ListingCustomAttributes } from "@/types/listing";
import {
  useAdminLinkMarketingOrder,
  useAdminMarketingOrder,
  useAdminOrderListing,
} from "@/hooks/useAdminMarketingOrders";

/**
 * Trình soạn email / banner mở từ một đơn "Giao việc cho sàn" (`?mkt_order=<id>`): dữ liệu điền
 * sẵn từ đơn + tin, và `linkBack` gắn bản vừa lưu vào đơn rồi quay về trang chi tiết đơn.
 * `orderId` null ⇒ trình soạn chạy như cũ.
 */
export function useMktOrderPrefill(orderId: string | null) {
  const navigate = useNavigate();
  const order = useAdminMarketingOrder(orderId);
  const listing = useAdminOrderListing(order.data?.listing_id);
  const link = useAdminLinkMarketingOrder();

  const value = useMemo(() => {
    const o = order.data;
    if (!o) return null;
    const l = listing.data
      ? {
          id: listing.data.id,
          title: listing.data.title,
          price: listing.data.price == null ? null : Number(listing.data.price),
          address: listing.data.address as ListingAddress | null,
          custom_attributes: listing.data.custom_attributes as ListingCustomAttributes | null,
        }
      : null;
    const origin = shortLinkBase();
    return { order: o, email: buildEmailPrefill(o, l, origin), ad: buildAdPrefill(o, origin) };
  }, [order.data, listing.data]);

  /** Gắn bản đã lưu vào đơn; true = đã xử lý điều hướng (caller không tự navigate nữa). */
  const linkBack = async (kind: "campaign" | "advertisement", targetId: string): Promise<boolean> => {
    if (!orderId) return false;
    try {
      await link.mutateAsync({ orderId, kind, targetId });
    } catch {
      // Lỗi đã toast ở hook; bản vừa lưu vẫn còn — admin gắn lại từ trang đơn.
    }
    navigate(`${ADMIN_MKT_ORDER_PATH}/${orderId}?tab=thuc-hien`);
    return true;
  };

  return {
    active: !!orderId,
    loading: !!orderId && (order.isLoading || (!!order.data?.listing_id && listing.isLoading)),
    prefill: value,
    linkBack,
  };
}

import { AlertTriangle } from "lucide-react";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import { DetailNote } from "./DetailCard";

/**
 * Đặt giá xuống: tài sản thiếu giá sàn thì org_open_lot từ chối (floor_missing).
 * Báo ngay ở tab Tài sản để tổ chức sửa trước ngày đấu, không phải giữa phiên.
 */
export function MissingFloorNotice({ session }: { session: AuctionSessionWithItems }) {
  if (session.bidding_method !== "descending") return null;
  const missing = session.auction_session_items.filter((i) => i.floor_price == null);
  if (missing.length === 0) return null;
  return (
    <DetailNote icon={<AlertTriangle />}>
      <p>
        Phiên theo phương thức <strong>đặt giá xuống</strong>: {missing.length} tài sản chưa có giá sàn (
        {missing.map((i) => `tài sản ${i.lot_no}`).join(", ")}) — chưa mở được. Bấm “Sửa” trên từng tài sản để đặt giá
        sàn.
      </p>
    </DetailNote>
  );
}

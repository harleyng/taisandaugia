// Suy diễn trạng thái phiên đấu giá từ listings.status + custom_attributes.
//
// BẢN SAO 1:1 của public.listing_session_status() trong
// supabase/migrations/20260805000003_admin_listings_report.sql — sửa một bên
// PHẢI sửa bên kia, nếu không báo cáo admin sẽ lệch với UI.
//
// Bẫy chính tả key trong custom_attributes: auction_date | auction_time,
// registration_deadline | document_sale_end.

export type AuctionSessionStatus = "registration_open" | "upcoming" | "ongoing" | "ended";

export const SESSION_STATUS_LABELS: Record<AuctionSessionStatus, string> = {
  registration_open: "Đang bán hồ sơ",
  upcoming: "Sắp diễn ra",
  ongoing: "Đang diễn ra",
  ended: "Đã kết thúc",
};

/** Thứ tự hiển thị theo vòng đời phiên (không theo số lượng). */
export const SESSION_STATUS_ORDER: AuctionSessionStatus[] = [
  "registration_open",
  "upcoming",
  "ongoing",
  "ended",
];

export function sessionStatusOf(
  status: string | null | undefined,
  customAttributes: unknown,
  now: Date = new Date(),
): AuctionSessionStatus {
  const ca = (customAttributes ?? null) as Record<string, unknown> | null;

  // Ghi đè tường minh
  const explicit = ca?.session_status;
  if (typeof explicit === "string") {
    if (explicit === "ongoing") return "ongoing";
    if (explicit === "ended") return "ended";
    if (explicit === "registration_open") return "registration_open";
    if (explicit === "upcoming") return "upcoming";
  }

  if (status === "SOLD_RENTED") return "ended";

  // auction_date / auction_time = thời điểm tổ chức phiên
  const auctionDateStr = (ca?.auction_date || ca?.auction_time) as string | undefined;
  const auctionDate = auctionDateStr ? new Date(auctionDateStr) : null;

  // registration_deadline / document_sale_end = hạn chót nộp hồ sơ
  const regDeadlineStr = (ca?.registration_deadline || ca?.document_sale_end) as string | undefined;
  const regDeadline = regDeadlineStr ? new Date(regDeadlineStr) : null;

  if (auctionDate && !Number.isNaN(auctionDate.getTime())) {
    if (auctionDate <= now) {
      // cửa sổ 2 tiếng coi như đang diễn ra
      const twoHoursLater = new Date(auctionDate.getTime() + 2 * 60 * 60 * 1000);
      if (now <= twoHoursLater) return "ongoing";
      return "ended";
    }

    if (regDeadline && !Number.isNaN(regDeadline.getTime())) {
      if (now <= regDeadline) return "registration_open";
      return "upcoming"; // hết hạn nộp hồ sơ nhưng chưa tới ngày đấu
    }

    return "registration_open";
  }

  return "registration_open"; // không có mốc thời gian nào
}

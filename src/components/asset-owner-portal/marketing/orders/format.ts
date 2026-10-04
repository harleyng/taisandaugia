import { format } from "date-fns";
import { vi } from "date-fns/locale";

/** "05/10/2026" — ngày trên danh sách đơn. */
export const formatOrderDate = (iso: string | null | undefined) => (iso ? format(new Date(iso), "dd/MM/yyyy") : "—");

/** "14:30, 05/10/2026" — mốc trên dòng thời gian / chi tiết. */
export const formatOrderTime = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), "HH:mm, dd/MM/yyyy", { locale: vi }) : "—";

/** "15/09 · 09:12" — mốc dưới từng bước của thanh tiến độ. */
export const formatStepTime = (iso: string | null | undefined) => (iso ? format(new Date(iso), "dd/MM · HH:mm") : "");

/** "23/09/2026 · 17:00" — hạn báo giá, lúc trả, lúc huỷ ở hero. */
export const formatHeroTime = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), "dd/MM/yyyy · HH:mm") : "—";

/** "21/09" — ngày ngắn trong dòng hạng mục và đầu bảng so sánh. */
export const formatShortDate = (iso: string | null | undefined) => (iso ? format(new Date(iso), "dd/MM") : "—");

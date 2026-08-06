/**
 * Lấy thông điệp lỗi để hiển thị cho người dùng.
 *
 * TypeScript kiểu biến `catch` là `unknown` (không phải Error) vì JS ném được
 * bất cứ giá trị gì. Trước đây code viết `catch (err: any)` rồi đọc thẳng
 * `err.message` — chạy được cho tới khi Supabase ném ra object không có
 * `message`, lúc đó toast hiện "undefined".
 */
export function errorMessage(e: unknown, fallback = "Đã có lỗi xảy ra, vui lòng thử lại"): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

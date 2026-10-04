// Mã khách ẩn danh của trang /hs/:code — chỉ để đếm lượt xem không trùng và chống bấm lặp.
// Không gắn với tài khoản, không gửi IP. localStorage có thể bị chặn (Zalo in-app browser ở
// chế độ riêng tư, Safari chặn cookie) ⇒ rơi về một mã trong bộ nhớ cho lần mở này.

const STORAGE_KEY = "tsdg.share.visitor";
const FORMAT = /^[A-Za-z0-9_-]{8,64}$/;

let memoryId: string | null = null;

function randomId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function shareVisitorId(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && FORMAT.test(stored)) return stored;
    const id = randomId();
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    memoryId ??= randomId();
    return memoryId;
  }
}

export type ShareDevice = "mobile" | "tablet" | "desktop";

/** Loại thiết bị thô theo User-Agent — server chỉ nhận 3 giá trị này. */
export function shareDevice(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): ShareDevice {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(userAgent)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Zalo/i.test(userAgent)) return "mobile";
  return "desktop";
}

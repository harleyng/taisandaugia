// Ghi nhớ một lựa chọn hiển thị (vd. chế độ xem Bảng / Giai đoạn) trong localStorage.
//
// Chỉ là tiện ích theo từng trình duyệt, không phải trạng thái cần bền: đọc/ghi
// luôn bọc try/catch (chế độ riêng tư, storage bị chặn) và giá trị lạ hay lỗi
// đều rơi về mặc định.

export function readStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredChoice(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage bị chặn — lựa chọn chỉ sống tới khi tải lại trang */
  }
}

import { useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Đưa bộ lọc của một trang danh sách lên query string.
 *
 * URL là nguồn sự thật duy nhất của bộ lọc: bấm back từ trang chi tiết hay tải
 * lại trang đều giữ nguyên lọc, và link dán cho người khác mở ra đúng danh sách
 * đang nhìn. Giá trị trùng mặc định không ghi lên URL để query string gọn; giá
 * trị lạ (link cũ, gõ tay) rơi về mặc định thay vì lọc ra danh sách rỗng khó hiểu.
 * Mọi thay đổi ghi bằng `replace` — gõ ô tìm kiếm không được nhồi từng ký tự vào
 * history, nếu không nút back phải bấm cả chục lần mới thoát khỏi trang.
 *
 * Tham số ngoài `defaults` (VD `?tab=`) được giữ nguyên khi đổi lọc.
 */
export function useUrlFilterState<T extends Record<string, string>>(
  defaults: T,
  /** Tập giá trị hợp lệ của từng khóa; khóa không khai báo thì nhận mọi chuỗi. */
  allowed?: Partial<Record<keyof T, readonly string[]>>,
) {
  const [params, setParams] = useSearchParams();

  // Hai object này thường là literal viết thẳng trong component nên đổi định
  // danh mỗi lần render — giữ qua ref để `setFilter` không bị tạo lại liên tục.
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const values = {} as T;
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const raw = params.get(key);
    const options = allowed?.[key];
    const valid = raw !== null && (!options || options.includes(raw));
    values[key] = (valid ? raw : defaults[key]) as T[keyof T & string];
  }

  const setFilter = useCallback(
    (key: keyof T & string, value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === defaultsRef.current[key]) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [values, setFilter] as const;
}

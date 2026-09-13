import "@testing-library/jest-dom";

// Một số test chạy môi trường `node` (xem pragma @vitest-environment ở đầu
// file đó) vì jsdom thiếu API cần kiểm — ví dụ crypto.subtle. Setup dùng chung
// phải im lặng ở đó thay vì đổ ReferenceError trước khi test kịp chạy.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null as ((e: MediaQueryListEvent) => void) | null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

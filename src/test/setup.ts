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

  // jsdom không có ResizeObserver, mà `ResponsiveContainer` của Recharts gọi nó
  // trong effect ⇒ MỌI test render biểu đồ sẽ chết bằng ReferenceError trước khi
  // kịp kiểm gì. Stub trả kích thước 0 là đủ: các test chỉ đọc nhãn và bảng
  // `sr-only` đi kèm biểu đồ, không đọc hình vẽ.
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
}

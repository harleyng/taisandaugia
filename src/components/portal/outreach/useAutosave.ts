import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "" | "saving" | "saved" | "error";

export const SAVE_STATUS_TEXT: Record<SaveStatus, string> = {
  "": "",
  saving: "Đang lưu…",
  saved: "Đã lưu",
  error: "Chưa lưu được",
};

/**
 * Tự lưu kiểu trình soạn (design pdg-mk3.js `mkBind`): mỗi lần gõ hẹn lại một lượt
 * lưu sau `delay` ms; lượt đang chờ được lưu nốt khi rời trang / đổi mục.
 */
export function useAutosave(delay = 700) {
  const [status, setStatus] = useState<SaveStatus>("");
  const timer = useRef<number | null>(null);
  const pending = useRef<(() => Promise<unknown>) | null>(null);

  const run = useCallback(async () => {
    const fn = pending.current;
    pending.current = null;
    timer.current = null;
    if (!fn) return;
    try {
      await fn();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  const schedule = useCallback(
    (fn: () => Promise<unknown>) => {
      pending.current = fn;
      setStatus("saving");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(run, delay);
    },
    [delay, run],
  );

  const flush = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    void run();
  }, [run]);

  useEffect(() => () => flush(), [flush]);

  return { status, schedule, flush };
}

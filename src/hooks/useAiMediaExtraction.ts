import { useCallback, useEffect, useRef, useState } from "react";
import { extractFromMedia, type ExtractionInput, type ExtractionResult } from "@/lib/aiMediaExtraction";

/**
 * Chạy "AI đọc ảnh/video tài sản" cho wizard số hoá.
 *
 * ĐÂY LÀ SEAM ĐỔI SANG AI THẬT. Hôm nay run() gọi engine mock đồng bộ rồi giả
 * độ trễ theo 4 chặng; khi có Edge Function chỉ cần đổi thân run() thành
 *
 *   const { data, error } = await supabase.functions.invoke("extract-asset-media",
 *     { body: { childSlug, parentSlug, province, imageUrls, videoUrls } });
 *
 * miễn là trả về đúng ExtractionResult — AiExtractionCard và panel duyệt không
 * phải sửa một dòng nào.
 *
 * Không dùng React Query: đây không phải server state (không cache theo key,
 * không ai invalidate, kết quả chỉ sống trong một lần dựng wizard).
 */

export const EXTRACTION_STAGES = [
  "Đang tải ảnh lên bộ nhận diện…",
  "Đang nhận diện đối tượng trong ảnh…",
  "Đang đọc thông số & giấy tờ…",
  "Đang đối chiếu dữ liệu thị trường…",
] as const;

/** Mỗi chặng ~450ms → tổng ~1,8s: đủ để thấy tiến trình, chưa đủ để sốt ruột. */
const STAGE_MS = 450;

export type ExtractionState =
  | { phase: "idle" }
  | { phase: "running"; stage: number }
  | { phase: "done"; result: ExtractionResult }
  | { phase: "error"; message: string };

export interface UseAiMediaExtraction {
  state: ExtractionState;
  /** 0..100, chỉ có nghĩa khi phase = "running". */
  progress: number;
  /** Path người dùng đã quyết (dùng hoặc bỏ qua) — không hiện gợi ý nữa. */
  resolved: ReadonlySet<string>;
  run: (input: ExtractionInput) => void;
  /** Đánh dấu đã quyết xong một hoặc nhiều trường. */
  resolve: (paths: string[]) => void;
  reset: () => void;
}

export function useAiMediaExtraction(): UseAiMediaExtraction {
  const [state, setState] = useState<ExtractionState>({ phase: "idle" });
  const [resolved, setResolved] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  // Rời wizard giữa lúc đang chạy thì các setState còn treo sẽ bắn vào component
  // đã unmount — dọn hết ở đây.
  useEffect(() => clearTimers, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setState({ phase: "idle" });
    setResolved(new Set());
  }, [clearTimers]);

  const resolve = useCallback((paths: string[]) => {
    setResolved((prev) => {
      const next = new Set(prev);
      paths.forEach((p) => next.add(p));
      return next;
    });
  }, []);

  const run = useCallback(
    (input: ExtractionInput) => {
      clearTimers();
      // Phân tích lại là một lượt mới: mọi quyết định của lượt trước hết hiệu lực.
      setResolved(new Set());

      if (input.imageUrls.length === 0) {
        setState({ phase: "error", message: "Cần ít nhất 1 ảnh tài sản để trích xuất." });
        return;
      }

      setState({ phase: "running", stage: 0 });

      // Chặng 1..n-1 chỉ đổi nhãn; chặng cuối mới thực sự lấy kết quả.
      for (let i = 1; i < EXTRACTION_STAGES.length; i++) {
        timers.current.push(
          window.setTimeout(() => setState({ phase: "running", stage: i }), STAGE_MS * i),
        );
      }

      timers.current.push(
        window.setTimeout(() => {
          const result = extractFromMedia(input);
          if (result.fields.length === 0) {
            setState({
              phase: "error",
              message: "Chưa hỗ trợ trích xuất tự động cho loại tài sản này. Bạn vui lòng nhập tay.",
            });
            return;
          }
          setState({ phase: "done", result });
        }, STAGE_MS * EXTRACTION_STAGES.length),
      );
    },
    [clearTimers],
  );

  const progress =
    state.phase === "running"
      ? Math.round(((state.stage + 1) / EXTRACTION_STAGES.length) * 100)
      : state.phase === "done"
        ? 100
        : 0;

  return { state, progress, resolved, run, resolve, reset };
}

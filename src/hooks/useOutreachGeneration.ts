import { useCallback, useEffect, useRef, useState } from "react";
import { generateOutreach, type OutreachDraft } from "@/lib/outreach/generateOutreach";
import type { OutreachInput } from "@/lib/outreach/outreachInput";

/**
 * Soạn gói tiếp thị cho một phiên.
 *
 * ĐÂY LÀ SEAM ĐỔI SANG MÔ HÌNH AI THẬT (cùng khuôn useAiMediaExtraction). Hôm nay
 * run() gọi engine mẫu tất định rồi giả độ trễ theo chặng; khi có Edge Function
 * chỉ cần đổi thân run() thành
 *
 *   const { data, error } = await supabase.functions.invoke("generate-outreach", { body: input });
 *
 * miễn là trả về đúng OutreachDraft. RÀNG BUỘC giữ nguyên khi đổi: mô hình chỉ
 * được trả channels / draftSlots (DraftSlotKey) / pitches — không bao giờ câu chữ
 * điều khoản; server vẫn chặn field_key lạ bằng CHECK.
 *
 * Không dùng React Query: kết quả không phải server state; nó được áp vào DB qua
 * useApplyGeneration (có nhật ký).
 */

export const GENERATION_STAGES = [
  "Đang đọc hồ sơ vụ việc…",
  "Đang soạn bản đăng từng kênh…",
  "Đang điền ô mô tả của thông báo…",
  "Đang viết câu chào theo phân khúc…",
] as const;

const STAGE_MS = 400;

export type GenerationState =
  | { phase: "idle" }
  | { phase: "running"; stage: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

export function useOutreachGeneration() {
  const [state, setState] = useState<GenerationState>({ phase: "idle" });
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const run = useCallback(
    (input: OutreachInput): Promise<OutreachDraft> =>
      new Promise((resolve, reject) => {
        clearTimers();
        if (input.lots.length === 0) {
          const message = "Phiên chưa có tài sản — thêm tài sản trước khi soạn gói tiếp thị.";
          setState({ phase: "error", message });
          reject(new Error(message));
          return;
        }
        setState({ phase: "running", stage: 0 });
        for (let i = 1; i < GENERATION_STAGES.length; i++) {
          timers.current.push(window.setTimeout(() => setState({ phase: "running", stage: i }), STAGE_MS * i));
        }
        timers.current.push(
          window.setTimeout(() => {
            try {
              const draft = generateOutreach(input);
              setState({ phase: "done" });
              resolve(draft);
            } catch (e) {
              const message = e instanceof Error ? e.message : "Không soạn được gói tiếp thị.";
              setState({ phase: "error", message });
              reject(e);
            }
          }, STAGE_MS * GENERATION_STAGES.length),
        );
      }),
    [clearTimers],
  );

  const progress =
    state.phase === "running" ? Math.round(((state.stage + 1) / GENERATION_STAGES.length) * 100) : state.phase === "done" ? 100 : 0;

  return { state, progress, run };
}

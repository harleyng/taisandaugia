import { useCallback, useEffect, useRef, useState } from "react";
import { caseQaErrorMessage } from "@/lib/caseQa/errors";
import {
  extractCaseDocument,
  type CaseExtractionInput,
  type CaseExtractionResult,
} from "@/lib/caseQa/caseExtraction";

/**
 * Chạy "trích xuất điều khoản" cho một tài liệu phiên.
 *
 * ĐÂY LÀ SEAM ĐỔI SANG OCR/LLM THẬT. Hôm nay run() gọi engine giả lập (không đọc
 * tệp) rồi giả độ trễ theo chặng; khi có Edge Function chỉ cần đổi phần lấy kết
 * quả thành
 *
 *   const { data, error } = await supabase.functions.invoke("extract-case-document",
 *     { body: { documentId } });
 *
 * miễn là trả về đúng CaseExtractionResult — thẻ tài liệu và bảng duyệt điều khoản
 * không phải sửa. Khi đó xoá luôn src/lib/caseQa/mockCaseExtraction.ts.
 *
 * Không dùng React Query: đây là một lượt chạy, không phải server state. Kết quả
 * được `persist` lưu thành điều khoản NHÁP; nguồn sự thật sau đó là bảng.
 */

// Nhãn nói thật: đây là dựng khuôn, không phải đọc tệp.
export const CASE_EXTRACTION_STAGES = [
  "Đang dựng khuôn điều khoản theo loại tài liệu…",
  "Đang điền dữ liệu của phiên…",
  "Đang đánh dấu chỗ cần nhập từ tệp gốc…",
  "Đang lưu điều khoản nháp…",
] as const;

const STAGE_MS = 450;

export type CaseExtractionState =
  | { phase: "idle" }
  | { phase: "running"; stage: number }
  | { phase: "done"; result: CaseExtractionResult }
  | { phase: "error"; message: string };

export function useCaseDocumentExtraction() {
  const [state, setState] = useState<CaseExtractionState>({ phase: "idle" });
  const timers = useRef<number[]>([]);
  const alive = useRef(true);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setState({ phase: "idle" });
  }, [clearTimers]);

  const run = useCallback(
    (input: CaseExtractionInput, persist: (result: CaseExtractionResult) => Promise<unknown>) => {
      clearTimers();
      setState({ phase: "running", stage: 0 });

      for (let i = 1; i < CASE_EXTRACTION_STAGES.length; i++) {
        timers.current.push(window.setTimeout(() => setState({ phase: "running", stage: i }), STAGE_MS * i));
      }

      timers.current.push(
        window.setTimeout(() => {
          const result = extractCaseDocument(input);
          if (result.clauses.length === 0) {
            setState({ phase: "error", message: "Chưa trích xuất được điều khoản nào. Hãy thêm điều khoản thủ công." });
            return;
          }
          persist(result)
            .then(() => alive.current && setState({ phase: "done", result }))
            .catch((err) => alive.current && setState({ phase: "error", message: caseQaErrorMessage(err) }));
        }, STAGE_MS * (CASE_EXTRACTION_STAGES.length - 1)),
      );
    },
    [clearTimers],
  );

  const progress =
    state.phase === "running"
      ? Math.round(((state.stage + 1) / CASE_EXTRACTION_STAGES.length) * 100)
      : state.phase === "done"
        ? 100
        : 0;

  return { state, progress, run, reset };
}

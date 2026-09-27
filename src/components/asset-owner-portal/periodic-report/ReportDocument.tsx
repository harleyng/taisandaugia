import type { ReportPayload } from "@/lib/ownerPeriodicReport";
import { ReportHero, ReportTargetsSection } from "./ReportTargetsSection";
import { ReportResultsSection } from "./ReportResultsSection";
import { ReportMoneySection } from "./ReportMoneySection";
import { ReportStuckSection } from "./ReportStuckSection";
import { ReportPlanSection } from "./ReportPlanSection";
import { ReportNotesSection } from "./ReportNotesSection";
import type { ReportVariant } from "./ReportTable";

interface ReportDocumentProps {
  payload: ReportPayload;
  status: "draft" | "final";
  variant?: ReportVariant;
  /** Trang chi tiết đã có hero riêng (DetailHero) ⇒ bỏ thẻ "Đã thu" ở đầu tài liệu. */
  showHero?: boolean;
}

/**
 * Nội dung báo cáo định kỳ theo 6 phần của §A5, dùng chung cho trang chi tiết, trang
 * in A4 và (Phase 11) link chia sẻ /r/:token. Chỉ hiển thị — mọi số đã tính ở server.
 * L1 (đã thu) → L3 (ô chỉ số) → L4 (bảng chi tiết, kèm nguồn từng dòng).
 */
export function ReportDocument({ payload, status, variant = "screen", showHero = true }: ReportDocumentProps) {
  return (
    <div className="space-y-6 print:space-y-4">
      {showHero && (
        <div className="break-inside-avoid rounded-2xl border bg-card p-5">
          <ReportHero payload={payload} />
        </div>
      )}
      <ReportTargetsSection payload={payload} />
      <ReportResultsSection payload={payload} variant={variant} />
      <ReportMoneySection payload={payload} variant={variant} />
      <ReportStuckSection payload={payload} variant={variant} />
      <ReportPlanSection payload={payload} variant={variant} />
      <ReportNotesSection payload={payload} status={status} />
    </div>
  );
}

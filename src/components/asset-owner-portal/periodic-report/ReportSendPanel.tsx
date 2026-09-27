import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatReportDay } from "@/lib/ownerPeriodicReport";

function Check({ done, title, hint }: { done: boolean; title: string; hint: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <i
        aria-hidden
        className={cn(
          "relative mt-px h-[18px] w-[18px] flex-none rounded-full",
          done
            ? "bg-primary after:absolute after:left-[6px] after:top-[3px] after:h-2 after:w-1 after:rotate-45 after:border-b-2 after:border-r-2 after:border-primary-foreground"
            : "ring-[1.5px] ring-inset ring-border",
        )}
      />
      <div>
        <span className="sr-only">{done ? "Đã xong: " : "Chưa xong: "}</span>
        {title}
        <small className="block text-xs text-muted-foreground">{hint}</small>
      </div>
    </li>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <b className="text-right font-semibold text-foreground">{children}</b>
    </div>
  );
}

interface DraftPanelProps {
  asOf: string | null;
  hasInsight: boolean;
  dueDate: string;
  overdue: boolean;
  /** null ⇒ người xem không chốt được (hiện ai sẽ chốt). */
  action: { label: string; disabled: boolean; onClick: () => void } | null;
}

/** Cột phải của bản nháp: việc cần làm trước khi chốt, hạn chốt, nơi nhận và nút chốt. */
export function ReportDraftPanel({ asOf, hasInsight, dueDate, overdue, action }: DraftPanelProps) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-card p-[18px] shadow-card">
      <h4 className="text-sm font-semibold text-foreground">Để chốt báo cáo</h4>
      <ul className="flex flex-col gap-2 text-[13.5px] text-foreground">
        <Check done title="Số liệu đã tổng hợp" hint={`Tự động${asOf ? `, cập nhật ${formatReportDay(asOf).slice(0, 5)}` : ""}`} />
        <Check done={hasInsight} title="Viết nhận định & đề xuất" hint="Ở cuối báo cáo" />
      </ul>
      <Row label={overdue ? "Quá hạn chốt" : "Hạn chốt"}>
        <span className={cn("tabular-nums", overdue && "text-destructive")}>{formatReportDay(dueDate)}</span>
      </Row>
      <Row label="Gửi tới">Trụ sở · link chỉ đọc</Row>
      {action ? (
        <Button className="w-full" disabled={action.disabled} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Trưởng đơn vị sẽ xem lại và chốt để gửi trụ sở.</p>
      )}
    </div>
  );
}

interface FinalPanelProps {
  finalizedAt: string | null;
  finalizedBy: string | null;
  preparedBy: string | null;
}

/** Cột phải của báo cáo đã chốt — thẻ "Chia sẻ với trụ sở" nằm ngay dưới. */
export function ReportFinalPanel({ finalizedAt, finalizedBy, preparedBy }: FinalPanelProps) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-card p-[18px] shadow-card">
      <h4 className="text-sm font-semibold text-foreground">Đã chốt</h4>
      <Row label="Ngày chốt">
        <span className="tabular-nums">{formatReportDay(finalizedAt)}</span>
      </Row>
      <Row label="Người chốt">{finalizedBy ?? "—"}</Row>
      <Row label="Người lập">{preparedBy ?? "—"}</Row>
      <p className="text-xs text-muted-foreground">Số liệu đã đóng băng — sửa kết quả phiên sau đó không làm đổi báo cáo.</p>
    </div>
  );
}

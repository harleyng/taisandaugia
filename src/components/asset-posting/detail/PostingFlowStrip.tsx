import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_RFQ_ORGS } from "@/constants/asset-posting-rules";
import { CONTRACT_STATUS_LABELS_OWNER, type ConsignmentContractStatus } from "@/types/consignment-contract";
import {
  DIGITIZE_TRACK,
  digitizeNextLine,
  type DigitizeStage,
  type DigitizeStatus,
} from "@/lib/asset-posting/digitizeStatus";

export interface FlowStripFacts {
  pct: number;
  sentCount: number;
  quotedCount: number;
  /** Tổ chức đã nhận mà chưa trả lời (sent/seen). */
  pendingCount: number;
  orgName: string | null;
  /** Hợp đồng dịch vụ đang sống (không huỷ), null khi chưa có. */
  contractStatus: ConsignmentContractStatus | null;
  rejectionReason: string | null;
  /** Hồ sơ Cá nhân — nháp chỉ chính chủ thấy; hồ sơ không gian thì cả đơn vị thấy. */
  personal: boolean;
}

interface PostingFlowStripProps {
  status: DigitizeStatus;
  facts: FlowStripFacts;
  /** Người xem / Cán bộ ngoài phạm vi: không có nút hành động, chỉ nút xem. */
  canWrite: boolean;
  onOpenWizard: () => void;
  onOpenConsignment: () => void;
}

function subLine(s: DigitizeStatus, f: FlowStripFacts): string {
  switch (s.stage) {
    case "draft":
      return f.personal
        ? "Hồ sơ nháp chỉ bạn thấy. Hoàn tất để gửi sàn duyệt."
        : "Hồ sơ nháp chỉ thành viên đơn vị thấy. Hoàn tất để gửi sàn duyệt.";
    case "review":
      return "Sau khi được duyệt, bạn có thể gửi hồ sơ cho tổ chức đấu giá.";
    case "rejected":
      return f.rejectionReason?.trim() || "Cập nhật hồ sơ rồi lưu lại để sàn xem xét lại.";
    case "ready":
      return `Gửi cho tối đa ${MAX_RFQ_ORGS} tổ chức hoặc nhờ sàn chọn giúp để nhận báo giá.`;
    case "quoting":
      return "Bạn sẽ nhận thông báo khi có báo giá đầu tiên.";
    case "resend":
      return "Gửi thêm tổ chức khác để tiếp tục nhận báo giá.";
    case "choose":
      return f.pendingCount > 0
        ? `${f.quotedCount} tổ chức đã báo giá · ${f.pendingCount} tổ chức chưa phản hồi.`
        : `${f.quotedCount} tổ chức đã báo giá.`;
    case "contract":
      if (s.ownerAction === "add_address") return "Bổ sung địa chỉ của bạn để tổ chức lập hợp đồng dịch vụ.";
      if (s.ownerAction === "confirm_contract") return "Tổ chức đã gửi hợp đồng dịch vụ, chờ bạn xác nhận.";
      return f.contractStatus ? `${CONTRACT_STATUS_LABELS_OWNER[f.contractStatus]}.` : "Tổ chức đang soạn hợp đồng dịch vụ.";
    case "signed":
      return "Theo dõi phiên đấu giá trong mục Ký gửi đấu giá.";
    case "cancelled":
      return "Hồ sơ không còn hiệu lực.";
  }
}

function kicker(s: DigitizeStatus): string {
  if (s.who === "owner") return "Việc của bạn";
  if (s.who === "platform") return "Đang chờ sàn";
  if (s.who === "org") return "Đang chờ tổ chức";
  return s.stage === "cancelled" ? "Đã huỷ" : "Hoàn tất";
}

/** Nút chính theo giai đoạn — chỉ khi người xem ghi được hồ sơ. */
const OWNER_CTA: Partial<Record<DigitizeStage, string>> = {
  draft: "Tiếp tục số hoá",
  rejected: "Sửa hồ sơ",
  ready: "Gửi cho tổ chức",
  resend: "Gửi thêm tổ chức",
  choose: "So sánh báo giá",
};

/** Giai đoạn có trang ký gửi để xem. */
const CONSIGNMENT_STAGES: readonly DigitizeStage[] = ["ready", "quoting", "resend", "choose", "contract", "signed"];

/**
 * Dải dưới đầu trang chi tiết: thanh 4 bước + hộp "bước tiếp theo" với MỘT nút.
 * Thao tác ký gửi (gửi, so sánh báo giá, hợp đồng) nằm ở menu Ký gửi đấu giá — nút
 * ở đây chỉ dẫn sang đó; nháp / bị trả lại thì mở lại wizard.
 */
export function PostingFlowStrip({ status: s, facts, canWrite, onOpenWizard, onOpenConsignment }: PostingFlowStripProps) {
  const mine = s.who === "owner";
  const err = s.tone === "err";
  const title = s.stage === "draft" ? `Hồ sơ hoàn thiện ${facts.pct}%` : digitizeNextLine(s, facts);

  let ctaLabel = OWNER_CTA[s.stage];
  if (s.stage === "contract" && mine) ctaLabel = s.ownerAction === "add_address" ? "Bổ sung địa chỉ" : "Xem & xác nhận";
  const wizardCta = s.stage === "draft" || s.stage === "rejected";

  let cta: ReactNode = null;
  if (canWrite && ctaLabel) {
    cta = (
      <Button onClick={wizardCta ? onOpenWizard : onOpenConsignment} className="shrink-0 gap-1.5 self-start sm:self-auto">
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    );
  } else if (CONSIGNMENT_STAGES.includes(s.stage)) {
    cta = (
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenConsignment}
        className="shrink-0 gap-1.5 self-start sm:self-auto"
      >
        Xem ký gửi
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="grid border-t border-border xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <ol className="flex items-start px-5 py-[18px] sm:px-6" aria-label="Tiến trình hồ sơ">
        {DIGITIZE_TRACK.map((label, i) => {
          const done = i < s.step;
          const cur = i === s.step && s.stage !== "cancelled";
          return (
            <li
              key={label}
              aria-current={cur ? "step" : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-start gap-2"
            >
              {i < DIGITIZE_TRACK.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn("absolute left-6 right-1.5 top-2.5 h-0.5", done ? "bg-primary" : "bg-border")}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-[1] grid h-[22px] w-[22px] place-items-center rounded-full border-2 bg-card text-primary-foreground",
                  done && "border-primary bg-primary",
                  cur && !err && "border-primary ring-4 ring-primary/15",
                  cur && err && "border-destructive ring-4 ring-destructive/15",
                  !done && !cur && "border-input",
                )}
              >
                {done && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  "pr-2 text-[11px] font-medium sm:text-[12.5px]",
                  done ? "text-foreground/70" : cur ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
                {done && <span className="sr-only"> (đã xong)</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className={cn(
          "flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6 xl:border-l xl:border-t-0",
          mine && !err && "bg-warning/10",
          mine && err && "bg-destructive/5",
        )}
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "mb-[3px] text-[11.5px] font-semibold uppercase tracking-[0.05em]",
              mine ? (err ? "text-destructive" : "text-foreground") : "text-muted-foreground",
            )}
          >
            {kicker(s)}
          </p>
          <p className="text-[14.5px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 whitespace-pre-line text-[13px] text-muted-foreground">{subLine(s, facts)}</p>
        </div>
        {cta}
      </div>
    </div>
  );
}

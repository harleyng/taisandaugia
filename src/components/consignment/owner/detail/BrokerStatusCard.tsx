import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrokerAssignee } from "@/hooks/useConsignmentOwnerView";
import type { AssetBrokerRequest } from "@/types/asset-posting";
import { KgCard } from "./KgCard";

const STEPS: { key: AssetBrokerRequest["status"]; label: string }[] = [
  { key: "pending", label: "Đã gửi sàn" },
  { key: "sourcing", label: "Đang tìm tổ chức" },
  { key: "quoted", label: "Có báo giá" },
  { key: "selected", label: "Đã chọn" },
];

interface BrokerStatusCardProps {
  broker: AssetBrokerRequest;
  /** Tổ chức sàn đã gửi hộ hồ sơ. */
  contactedCount: number;
  canCancel: boolean;
  isCancelling: boolean;
  onCancel: () => void;
}

/** Tiến độ yêu cầu "nhờ sàn chọn giúp": 4 bước, ghi chú của chủ tài sản, chuyên viên, ngày dự kiến. */
export function BrokerStatusCard({ broker, contactedCount, canCancel, isCancelling, onCancel }: BrokerStatusCardProps) {
  const { data: assignee } = useBrokerAssignee(broker.asset_posting_id, !!broker.assigned_admin_id);
  const idx = STEPS.findIndex((s) => s.key === broker.status);

  return (
    <KgCard
      title="Sàn đang chọn tổ chức giúp bạn"
      aux={assignee ? `Chuyên viên: ${assignee}` : "Chờ chuyên viên tiếp nhận"}
    >
      <ol className="flex gap-1.5" aria-label="Tiến độ nhờ sàn">
        {STEPS.map((s, i) => (
          <li key={s.key} aria-current={i === idx ? "step" : undefined} className="flex min-w-0 flex-1 flex-col gap-[7px]">
            <i aria-hidden="true" className={cn("h-1 rounded-sm", i <= idx ? "bg-primary" : "bg-border")} />
            <span className={cn("text-xs", i <= idx ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.label}</span>
          </li>
        ))}
      </ol>

      {broker.note && (
        <div className="mt-4 rounded-[9px] bg-muted/40 px-3.5 py-[11px] text-[13.5px] text-foreground">
          <span className="mb-0.5 block text-[11.5px] text-muted-foreground">Ghi chú của bạn</span>“{broker.note}”
        </div>
      )}

      <dl className="mt-3.5 flex flex-col">
        <div className="flex justify-between gap-3 border-t border-border py-[9px] text-[13.5px]">
          <dt className="text-muted-foreground">Tổ chức đã liên hệ</dt>
          <dd className="text-right font-semibold text-foreground">{contactedCount}</dd>
        </div>
        {broker.expected_quote_by && (
          <div className="flex justify-between gap-3 border-t border-border py-[9px] text-[13.5px]">
            <dt className="text-muted-foreground">Báo giá dự kiến</dt>
            <dd className="text-right font-semibold text-foreground">
              {format(parseISO(broker.expected_quote_by), "dd/MM/yyyy")}
            </dd>
          </div>
        )}
      </dl>

      {/* Huỷ được khi sàn chưa gửi đi đâu; đã có báo giá thì chọn hoặc để đó. */}
      {canCancel && broker.status === "pending" && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-destructive hover:underline disabled:opacity-60"
        >
          {isCancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Huỷ yêu cầu nhờ sàn
        </button>
      )}
    </KgCard>
  );
}

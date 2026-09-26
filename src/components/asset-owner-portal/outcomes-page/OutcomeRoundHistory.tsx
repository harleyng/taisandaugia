import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoneyFull } from "@/utils/money";
import { outcomeEvidenceUrl } from "@/hooks/useOwnerOutcomeEdit";
import {
  OUTCOME_KIND_LABEL,
  OUTCOME_SOURCE_KIND_LABEL,
  RESOLVED_OUTCOME_KINDS,
  unsoldReasonLabel,
  type OutcomeSourceKind,
  type ResolvedOutcomeKind,
} from "@/lib/ownerOutcomes";
import type { OwnerOutcomeRecord } from "@/lib/ownerOutcomeEdit";

const formatDay = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function outcomeText(r: OwnerOutcomeRecord): string {
  const kind = (RESOLVED_OUTCOME_KINDS as readonly string[]).includes(r.outcome)
    ? OUTCOME_KIND_LABEL[r.outcome as ResolvedOutcomeKind]
    : r.outcome;
  if (r.outcome === "sold" && r.winning_price !== null) return `${kind} · ${formatMoneyFull(r.winning_price)}`;
  const reason = r.outcome === "unsold" ? unsoldReasonLabel(r.failure_reason) : r.failure_reason;
  return reason ? `${kind} · ${reason}` : kind;
}

function resolutionText(r: OwnerOutcomeRecord): string | null {
  const res = r.conflict_resolution as { choice?: string; adopted?: { kind?: string } | null } | null;
  if (!res?.choice) return null;
  if (res.choice === "keep_mine") return "Đã giữ số của đơn vị khi các nguồn lệch nhau";
  const kind = res.adopted?.kind as OutcomeSourceKind | undefined;
  return `Đã dùng số của ${kind ? OUTCOME_SOURCE_KIND_LABEL[kind].toLowerCase() : "nguồn khác"}`;
}

async function openEvidence(path: string) {
  // Mở tab trước (trong cú bấm) để trình duyệt không chặn popup, rồi mới xin link ký.
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  try {
    const url = await outcomeEvidenceUrl(path);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  } catch {
    tab?.close();
    toast.error("Không mở được biên bản. Vui lòng thử lại.");
  }
}

interface OutcomeRoundHistoryProps {
  records: OwnerOutcomeRecord[];
  isLoading: boolean;
  canWrite: boolean;
  onEdit: (record: OwnerOutcomeRecord) => void;
  onDelete: (record: OwnerOutcomeRecord) => void;
}

/** Các lượt đơn vị đã tự khai cho một tài sản — lượt mới nhất trước. */
export function OutcomeRoundHistory({ records, isLoading, canWrite, onEdit, onDelete }: OutcomeRoundHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }
  if (!records.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Đơn vị chưa khai lượt nào cho tài sản này — con số đang hiển thị lấy từ nguồn khác.
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-xl border">
      {records.map((r) => {
        const resolution = resolutionText(r);
        return (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium text-foreground">
                Lượt {r.round_no} <span className="font-normal tabular-nums text-muted-foreground">· {formatDay(r.auction_date)}</span>
              </p>
              <p className="tabular-nums text-foreground">{outcomeText(r)}</p>
              <p className="text-xs text-muted-foreground">
                {r.source === "owner_import" ? "Nhập từ Excel" : "Khai trên Trạm Điều Hành"}
                {r.participants !== null ? ` · ${r.participants} người tham gia` : ""}
              </p>
              {resolution && <p className="text-xs text-muted-foreground">{resolution}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {r.evidence_urls[0] && (
                <Button variant="ghost" size="sm" onClick={() => void openEvidence(r.evidence_urls[0])}>
                  Xem biên bản
                </Button>
              )}
              {canWrite && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(r)}>
                    Sửa
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(r)}>
                    Xoá
                  </Button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

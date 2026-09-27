import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { KG_REQUEST_LABEL, orgInitials } from "@/lib/consignment/ownerConsignmentView";
import type { ConsignmentOrgDot, OwnerConsignmentRow } from "@/hooks/useOwnerConsignments";
import type { ServiceRequestStatus } from "@/types/asset-posting";

const DOT_CLASS: Record<ServiceRequestStatus, string> = {
  sent: "bg-muted text-muted-foreground ring-1 ring-inset ring-input",
  seen: "bg-muted text-foreground/70 ring-1 ring-inset ring-foreground/20",
  quoted: "bg-primary/15 text-primary",
  accepted: "bg-primary text-primary-foreground",
  selected: "bg-primary text-primary-foreground",
  declined: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25 line-through",
  not_selected: "bg-muted text-muted-foreground opacity-45",
  withdrawn: "bg-muted text-muted-foreground opacity-45",
  contract_cancelled: "bg-muted text-muted-foreground opacity-45",
};

function Dot({ d }: { d: ConsignmentOrgDot }) {
  const label = `${d.orgName} · ${KG_REQUEST_LABEL[d.status]}`;
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "-ml-[5px] grid h-6 w-6 place-items-center rounded-full border-2 border-card text-[9px] font-bold first:ml-0",
        DOT_CLASS[d.status],
      )}
    >
      {orgInitials(d.orgName)}
    </span>
  );
}

/** Cột "Tổ chức": chấm từng tổ chức đã nhận hồ sơ + một dòng tóm tắt. */
export function ConsignmentOrgsCell({ row }: { row: OwnerConsignmentRow }) {
  if (row.brokerOpen) {
    return (
      <div className="min-w-0 text-[13px]">
        <span className="inline-flex items-center gap-[5px] rounded-full bg-primary/5 px-[9px] py-[3px] text-xs font-semibold text-primary">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Sàn chọn giúp
        </span>
        <p className="mt-[5px] truncate text-xs text-foreground/70">Đã liên hệ {row.brokerContacted} tổ chức</p>
      </div>
    );
  }
  if (row.orgs.length === 0) return <p className="text-[13px] text-muted-foreground">Chưa gửi</p>;

  const summary = row.chosenOrgName
    ? row.chosenOrgName
    : [`${row.quotedCount}/${row.sentCount} báo giá`, row.declinedCount > 0 && `${row.declinedCount} từ chối`]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className="min-w-0 text-[13px]">
      <div className="flex">
        {row.orgs.map((d) => (
          <Dot key={d.orgId} d={d} />
        ))}
      </div>
      <p className="mt-[5px] truncate text-xs text-foreground/70">{summary}</p>
    </div>
  );
}

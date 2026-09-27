import { Fragment, type ReactNode } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { KG_REQUEST_LABEL, orgSubLine } from "@/lib/consignment/ownerConsignmentView";
import type { RequestWithOrg } from "@/hooks/useAssetPosting";
import { ToneLabel } from "../KgStatusParts";
import { KgCard, KgOrg } from "./KgCard";

const MINI_STEPS = ["Đã gửi", "Đã xem", "Báo giá"] as const;
const dm = (iso: string) => format(new Date(iso), "dd/MM");

function WaitingSteps({ r, today }: { r: RequestWithOrg; today: string }) {
  const reached = r.status === "seen" ? 1 : 0;
  const overdue = r.respond_by < today;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {MINI_STEPS.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <span aria-hidden="true" className="h-px w-3.5 bg-input" />}
          <span className={cn("flex items-center gap-[5px]", i <= reached && "font-semibold text-foreground")}>
            <i
              aria-hidden="true"
              className={cn("h-2 w-2 rounded-full border-[1.5px]", i <= reached ? "border-primary bg-primary" : "border-input")}
            />
            {label}
          </span>
        </Fragment>
      ))}
      <b className={cn("ml-auto font-medium tabular-nums", overdue ? "text-destructive" : "text-muted-foreground")}>
        {overdue ? "Quá hạn" : dm(r.seen_at ?? r.created_at)}
      </b>
    </div>
  );
}

function RequestState({ r, today }: { r: RequestWithOrg; today: string }) {
  if (r.status === "sent" || r.status === "seen") return <WaitingSteps r={r} today={today} />;
  if (r.status === "declined") {
    return (
      <div>
        <ToneLabel tone="err">Từ chối · {dm(r.updated_at)}</ToneLabel>
        {r.decline_reason && <p className="mt-[3px] text-[12.5px] text-foreground/70">{r.decline_reason}</p>}
      </div>
    );
  }
  return <ToneLabel tone="draft">{KG_REQUEST_LABEL[r.status]}</ToneLabel>;
}

interface OrgRequestRowsProps {
  title: string;
  requests: RequestWithOrg[];
  recordOf: (orgId: string) => string | null;
  aux?: ReactNode;
  /** Dòng thao tác cuối thẻ (vd. gửi thêm tổ chức). */
  footer?: ReactNode;
}

/** Các tổ chức chưa / không báo giá: tiến độ đã gửi → đã xem, lý do từ chối, đã đóng. */
export function OrgRequestRows({ title, requests, recordOf, aux, footer }: OrgRequestRowsProps) {
  if (requests.length === 0 && !footer) return null;
  const today = format(new Date(), "yyyy-MM-dd");
  return (
    <KgCard title={title} aux={aux} bodyClassName="pt-1.5">
      {requests.map((r) => (
        <div
          key={r.id}
          className="grid items-center gap-2 border-t border-border py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-4"
        >
          <KgOrg
            name={r.org?.name ?? "Tổ chức đấu giá"}
            logoUrl={r.org?.logo_url}
            sub={orgSubLine(r.org?.province, recordOf(r.auction_org_id))}
          />
          <RequestState r={r} today={today} />
        </div>
      ))}
      {footer && <div className={cn(requests.length > 0 && "mt-1 border-t border-border pt-3")}>{footer}</div>}
    </KgCard>
  );
}

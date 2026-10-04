import { Fragment } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DATA_FLOW_SIDE_LABEL, type DataFlowLevel, type DataFlowSide } from "@/lib/ownerMarketing/dataFlow";

const SIDE_CLASS: Record<DataFlowSide, string> = {
  bank: "text-primary",
  buyer: "text-muted-foreground",
  platform: "text-warning",
};

function Arrow() {
  return (
    <div aria-hidden="true" className="flex shrink-0 items-center justify-center text-muted-foreground">
      <ArrowDown className="h-4 w-4 sm:hidden" strokeWidth={1.5} />
      <ArrowRight className="hidden h-4 w-4 sm:block" strokeWidth={1.5} />
    </div>
  );
}

/** Vạch "ranh giới dữ liệu": ngang trên điện thoại, dọc trên màn rộng. */
function Boundary({ note }: { note: string }) {
  return (
    <div
      role="separator"
      aria-label={`Ranh giới dữ liệu: ${note}`}
      className="flex shrink-0 items-center gap-2 sm:w-28 sm:flex-col sm:justify-center"
    >
      <span aria-hidden="true" className="h-0 flex-1 border-t-2 border-dashed border-warning sm:h-auto sm:w-0 sm:border-l-2 sm:border-t-0" />
      <p className="max-w-[11rem] text-center text-[11.5px] font-medium leading-snug text-foreground">{note}</p>
      <span aria-hidden="true" className="h-0 flex-1 border-t-2 border-dashed border-warning sm:h-auto sm:w-0 sm:border-l-2 sm:border-t-0" />
    </div>
  );
}

/** Sơ đồ dòng dữ liệu của một mức triển khai — đọc từ trái sang phải (trên xuống trên điện thoại). */
export function DataFlowDiagram({ level }: { level: DataFlowLevel }) {
  const boundaryAtEnd = level.boundaryAfter >= level.flow.length;
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row">
      {level.flow.map((node, i) => (
        <Fragment key={node.title}>
          {i > 0 && (i === level.boundaryAfter ? <Boundary note={level.boundaryNote} /> : <Arrow />)}
          <div className="min-w-0 flex-1 rounded-xl bg-muted/60 p-3">
            <p className={cn("text-[11px] font-semibold uppercase tracking-wide", SIDE_CLASS[node.side])}>
              {DATA_FLOW_SIDE_LABEL[node.side]}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{node.title}</p>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{node.detail}</p>
          </div>
        </Fragment>
      ))}
      {boundaryAtEnd && <Boundary note={level.boundaryNote} />}
    </div>
  );
}

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ReportPayload, ReportStatus } from "@/lib/ownerPeriodicReport";
import { ReportDocument } from "./ReportDocument";

/** Toàn bộ số liệu chi tiết (5 phần của §A5, như bản PDF) — thu gọn mặc định. */
export function ReportDetailsSection({ payload, status }: { payload: ReportPayload; status: ReportStatus }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-2xl bg-card px-5 py-[18px] text-left shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span>
          <span className="block text-[15px] font-semibold text-foreground">Chi tiết số liệu</span>
          <span className="block text-[12.5px] text-muted-foreground">
            Chỉ tiêu, kết quả từng phiên, tiền thu, tồn đọng và lịch kỳ tới — giống bản PDF
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ReportDocument payload={payload} status={status} showHero={false} showNotes={false} />
      </CollapsibleContent>
    </Collapsible>
  );
}

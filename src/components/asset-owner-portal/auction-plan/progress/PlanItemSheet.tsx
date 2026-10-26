import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { monthLabel } from "@/lib/auctionPlan/totals";
import type { PlanItemProgress } from "@/hooks/useAuctionPlanProgress";
import type { AuctionPlan, AuctionPlanItemStep } from "@/lib/auctionPlan/types";
import { PlanForecastDialog } from "./PlanForecastDialog";
import { PlanHealthChip } from "./PlanHealthChip";
import { PlanItemExecCard } from "./PlanItemExecCard";
import { PlanItemLinksCard } from "./PlanItemLinksCard";
import { PlanLinkDialog, type PlanLinkKind } from "./PlanLinkDialog";
import { PlanStepChecklist } from "./PlanStepChecklist";
import { PlanStepDoneDialog } from "./PlanStepDoneDialog";
import { PlanItemFollowLine } from "../public/PlanItemFollowLine";

// Nút đóng mặc định của Sheet là con cuối — đổi thành ô vuông 32px nền xám (§A8).
const CLOSE_BTN =
  "[&>button:last-child]:right-4 [&>button:last-child]:top-4 [&>button:last-child]:flex [&>button:last-child]:h-8 [&>button:last-child]:w-8 [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:rounded-lg [&>button:last-child]:bg-muted [&>button:last-child]:text-muted-foreground [&>button:last-child]:opacity-100";

interface PlanItemSheetProps {
  row: PlanItemProgress | null;
  plan: AuctionPlan;
  canEdit: boolean;
  baselineOpen: boolean;
  asOf: string;
  onClose: () => void;
}

/**
 * Ngăn chi tiết một mục kế hoạch: mốc công việc → liên kết & kết quả → trường
 * thực hiện. Mỗi hộp thoại là một component riêng.
 */
export function PlanItemSheet({ row, plan, canEdit, baselineOpen, asOf, onClose }: PlanItemSheetProps) {
  const [step, setStep] = useState<AuctionPlanItemStep | null>(null);
  const [linking, setLinking] = useState<PlanLinkKind | null>(null);
  const [forecasting, setForecasting] = useState(false);

  if (!row) return null;
  const { item } = row;

  return (
    <>
      <Sheet open onOpenChange={(v) => !v && onClose()}>
        <SheetContent className={`w-full overflow-y-auto sm:max-w-xl ${CLOSE_BTN}`}>
          <SheetHeader className="pr-10 text-left">
            <SheetTitle className="flex flex-wrap items-center gap-2 text-base">
              <span className="min-w-0 truncate">{item.title}</span>
              <PlanHealthChip health={row.health} />
            </SheetTitle>
            <SheetDescription>
              {item.item_code} · kế hoạch {monthLabel(row.baselineMonth)} · {row.progress.done}/{row.progress.total} mốc
              đã xong
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Mốc công việc</h3>
              <PlanStepChecklist steps={row.steps} canEdit={canEdit} asOf={asOf} onOpenStep={setStep} />
            </section>

            {/* Phase 10 — tín hiệu nhu cầu từ người mua trên trang công khai. */}
            <PlanItemFollowLine planId={plan.id} itemId={item.id} />

            <Separator />
            <PlanItemLinksCard
              item={item}
              plan={plan}
              outcome={row.outcome}
              canEdit={canEdit}
              onLink={setLinking}
            />

            <Separator />
            <PlanItemExecCard
              item={item}
              plan={plan}
              canEdit={canEdit}
              baselineOpen={baselineOpen}
              onForecast={() => setForecasting(true)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <PlanStepDoneDialog step={step} plan={plan} onOpenChange={(v) => !v && setStep(null)} />
      <PlanLinkDialog kind={linking} item={item} plan={plan} onOpenChange={(v) => !v && setLinking(null)} />
      {forecasting && <PlanForecastDialog item={item} plan={plan} onOpenChange={(v) => !v && setForecasting(false)} />}
    </>
  );
}

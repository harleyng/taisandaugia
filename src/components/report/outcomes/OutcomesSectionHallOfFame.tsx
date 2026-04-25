import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ReportSection } from "../ReportSection";
import { hallOfFameRows, type HallOfFameRow } from "@/lib/mockOutcomesReport";

export const OutcomesSectionHallOfFame = () => {
  const [selected, setSelected] = useState<HallOfFameRow | null>(null);

  return (
    <ReportSection
      id="outcomes-c6"
      label="C6"
      title="Hall of Fame — tài sản đấu nhiều lần"
      keyInsight="Một số tài sản đã trải qua 3–5 lần đấu giá với mức giảm tích lũy 18–35%. Click vào từng dòng để xem nguyên nhân chi tiết."
      deepDiveLabel=""
      hideDeepDive
    >
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-semibold px-4 py-3">Tài sản</th>
                <th className="text-left font-semibold px-4 py-3">Loại</th>
                <th className="text-right font-semibold px-4 py-3">Số lần</th>
                <th className="text-right font-semibold px-4 py-3">Mức giảm TB</th>
                <th className="text-left font-semibold px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {hallOfFameRows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="border-t border-border cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{r.asset}</p>
                    <p className="text-xs text-muted-foreground">{r.location}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.type}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {r.rounds}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-destructive">
                    {r.avgDrop}%
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="font-normal">
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-muted-foreground bg-muted/30 border-t border-border">
          → Click 1 dòng để xem chi tiết nguyên nhân
        </p>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <Badge variant="secondary" className="w-fit mb-1">
                  {selected.type}
                </Badge>
                <SheetTitle className="text-left">{selected.asset}</SheetTitle>
                <SheetDescription className="text-left">{selected.location}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Số lần đấu giá</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
                      {selected.rounds}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Mức giảm TB</p>
                    <p className="text-2xl font-bold text-destructive tabular-nums mt-1">
                      {selected.avgDrop}%
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Diễn biến giá khởi điểm</p>
                  <p className="text-sm font-medium text-foreground">{selected.startPrice}</p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Trạng thái hiện tại</p>
                  <p className="text-sm font-medium text-foreground">{selected.status}</p>
                </div>

                <div className="rounded-lg bg-primary/5 border-l-4 border-l-primary p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                    Nguyên nhân
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">{selected.note}</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </ReportSection>
  );
};

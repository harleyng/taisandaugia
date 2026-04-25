import { Bookmark, CalendarDays, Download, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { outcomesMeta } from "@/lib/mockOutcomesReport";

export const OutcomesHero = () => {
  const { toast } = useToast();
  const soon = (title: string) =>
    toast({ title, description: "Tính năng sẽ sớm có trong bản cập nhật tới." });

  return (
    <section className="border-b border-border bg-gradient-to-b from-primary/5 to-background">
      <div className="container py-8 md:py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
              Báo cáo chuyên sâu
            </p>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight">
              {outcomesMeta.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Gavel className="h-4 w-4" />
                <span className="font-medium text-foreground">
                  {outcomesMeta.sessionCount.toLocaleString("vi-VN")} phiên đấu giá
                </span>
              </span>
              <span>·</span>
              <span>{outcomesMeta.periodDays} ngày qua</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Cập nhật:{" "}
                <span className="font-medium text-foreground">{outcomesMeta.updatedAt}</span>
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => soon("Đang chuẩn bị PDF")}>
              <Download className="h-4 w-4" />
              Tải PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => soon("Đã lưu báo cáo")}>
              <Bookmark className="h-4 w-4" />
              Lưu
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

import { Download, CalendarDays, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { reportMeta } from "@/lib/mockMarketReport";

export const ReportHero = () => {
  const { toast } = useToast();

  const handleDownload = () => {
    toast({
      title: "Đang chuẩn bị PDF",
      description: "Báo cáo tổng sẽ được gửi đến email của bạn trong ít phút.",
    });
  };

  return (
    <section className="border-b border-border bg-gradient-to-b from-primary/5 to-background">
      <div className="container py-10 md:py-14">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Báo cáo định kỳ
            </p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              {reportMeta.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Cập nhật: <span className="font-medium text-foreground">{reportMeta.updatedAt}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gavel className="h-4 w-4" />
                <span className="font-medium text-foreground">
                  {reportMeta.sessionCount.toLocaleString("vi-VN")} phiên
                </span>{" "}
                trong {reportMeta.periodDays} ngày qua
              </span>
            </div>
          </div>

          <Button onClick={handleDownload} size="lg" className="shrink-0">
            <Download className="h-4 w-4" />
            Tải PDF tổng
          </Button>
        </div>
      </div>
    </section>
  );
};

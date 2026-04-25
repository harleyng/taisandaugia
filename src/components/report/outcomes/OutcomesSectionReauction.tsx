import { ArrowDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReportSection } from "../ReportSection";
import { useToast } from "@/hooks/use-toast";
import { reauctionFunnel } from "@/lib/mockOutcomesReport";

const FunnelStep = ({
  title,
  caption,
  widthPct,
  tone = "primary",
}: {
  title: string;
  caption?: string;
  widthPct: number;
  tone?: "primary" | "muted" | "accent" | "destructive";
}) => {
  const toneClasses = {
    primary: "bg-primary/10 border-primary/40 text-foreground",
    muted: "bg-muted border-border text-foreground",
    accent: "bg-accent/15 border-accent/40 text-foreground",
    destructive: "bg-destructive/10 border-destructive/40 text-foreground",
  }[tone];

  return (
    <div className="mx-auto" style={{ width: `${widthPct}%`, minWidth: "60%" }}>
      <div className={`rounded-lg border px-4 py-3 text-center ${toneClasses}`}>
        <p className="text-sm md:text-base font-semibold">{title}</p>
        {caption && (
          <p className="text-xs text-muted-foreground mt-0.5">{caption}</p>
        )}
      </div>
    </div>
  );
};

export const OutcomesSectionReauction = () => {
  const { toast } = useToast();
  const f = reauctionFunnel;

  return (
    <ReportSection
      id="outcomes-c5"
      label="C5"
      title="Phiên đấu giá lại — pattern quan trọng"
      keyInsight={`Sau khi 1 phiên thất bại, ${f.reauctioned}% được tổ chức lại trong 60 ngày, với giá khởi điểm trung bình giảm ${f.priceDropPct}%. Đây là điểm vào tốt cho người mua kiên nhẫn.`}
      deepDiveLabel=""
      hideDeepDive
    >
      <Card className="p-6">
        <div className="space-y-3">
          <FunnelStep
            title={`${f.failed} phiên thất bại lần 1`}
            widthPct={100}
            tone="muted"
          />
          <div className="flex justify-center">
            <ArrowDown className="h-5 w-5 text-muted-foreground" />
          </div>
          <FunnelStep
            title={`${f.reauctioned} phiên được tổ chức lại`}
            caption={`Trung bình ${f.avgDays} ngày sau lần 1`}
            widthPct={80}
            tone="primary"
          />
          <div className="flex justify-center">
            <ArrowDown className="h-5 w-5 text-muted-foreground" />
          </div>
          <FunnelStep
            title={`Giá khởi điểm lần 2 giảm trung bình ${f.priceDropPct}%`}
            widthPct={70}
            tone="accent"
          />
          <div className="flex justify-center">
            <ArrowDown className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-[80%] mx-auto">
            <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-primary tabular-nums">{f.reSuccess}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Thành công lần 2 ({Math.round((f.reSuccess / f.reauctioned) * 100)}%)
              </p>
            </div>
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-destructive tabular-nums">{f.reFailed}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Thất bại lần 2 ({Math.round((f.reFailed / f.reauctioned) * 100)}%)
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-border flex justify-end">
          <Button
            variant="outline"
            onClick={() =>
              toast({
                title: "Đang chuẩn bị danh sách",
                description: "Tính năng lọc tài sản đang đấu giá lại sẽ sớm có mặt.",
              })
            }
          >
            Xem tài sản đang đấu giá lại
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </ReportSection>
  );
};

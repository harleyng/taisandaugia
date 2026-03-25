import { Landmark, Calculator, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const tools = [
  {
    icon: Calculator,
    title: "Định giá tài sản đấu giá",
    description: "Ước tính giá trị tài sản trước khi tham gia đấu giá dựa trên dữ liệu thị trường",
    cta: "Định giá ngay",
  },
  {
    icon: Landmark,
    title: "Hỗ trợ vay vốn khi trúng đấu giá",
    description: "Lãi suất ưu đãi từ đối tác ngân hàng. Giải ngân nhanh - Thủ tục đơn giản",
    cta: "Tìm hiểu thêm",
  },
  {
    icon: Scale,
    title: "Tư vấn pháp lý đấu giá",
    description: "Tra cứu quy định, điều kiện tham gia và quy trình đấu giá tài sản",
    cta: "Tìm hiểu thêm",
  },
];

export const SupportTools = () => {
  return (
    <section className="bg-secondary/50 py-6 md:py-8">
      <div className="container px-4">
        <div className="mb-6 md:mb-8">
          <h2 className="text-lg md:text-2xl font-medium text-foreground mb-1">Công cụ hỗ trợ</h2>
          <p className="text-xs md:text-sm text-muted-foreground">Các tiện ích giúp bạn tham gia đấu giá hiệu quả</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card
                key={tool.title}
                className="relative border-border bg-card hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-primary/5" />
                <div className="absolute -bottom-4 -left-4 w-14 h-14 rounded-full bg-primary/[0.03]" />
                <CardContent className="relative p-5 md:p-6">
                  <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                    <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-semibold text-foreground text-base mb-2">{tool.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{tool.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-primary border-primary/30 hover:bg-foreground hover:text-background hover:border-foreground"
                  >
                    {tool.cta}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

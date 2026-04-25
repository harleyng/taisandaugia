import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export const ReportSubscribeForm = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      toast({
        title: "Đã đăng ký",
        description: `Báo cáo hàng tháng sẽ được gửi đến ${email}.`,
      });
      setEmail("");
      setSubmitting(false);
    }, 400);
  };

  return (
    <section id="subscribe" className="scroll-mt-20 pt-10 md:pt-14">
      <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/20">
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
          <div className="flex items-start gap-4 flex-1">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-1">
                Đăng ký nhận báo cáo hàng tháng
              </h3>
              <p className="text-sm text-muted-foreground">
                Nhận bản tổng hợp dữ liệu đấu giá tài sản mới nhất qua email vào đầu mỗi tháng.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:min-w-[360px]">
            <Input
              type="email"
              required
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? "Đang gửi..." : "Đăng ký"}
            </Button>
          </form>
        </div>
      </Card>
    </section>
  );
};

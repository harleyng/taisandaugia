import { useState } from "react";
import { ArrowRight, Database, Download, FileSpreadsheet, Filter, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export const BdsFinalCTA = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const fakeAction = (title: string) =>
    toast({ title, description: "Tính năng sẽ sớm có trong bản cập nhật tới." });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({
      title: "Đăng ký thành công",
      description: `Báo cáo BĐS hàng tháng sẽ gửi tới ${email}.`,
    });
    setEmail("");
  };

  return (
    <Card className="p-6 md:p-8 border-l-4 border-l-primary">
      <div className="flex items-center gap-2 mb-4">
        <Download className="h-5 w-5 text-primary" />
        <h2 className="text-base md:text-lg font-semibold text-foreground">Lấy dữ liệu này</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <Button onClick={() => fakeAction("Đang chuẩn bị PDF")} className="justify-start">
          <Download className="h-4 w-4" />
          Tải báo cáo PDF
        </Button>
        <Button
          variant="outline"
          onClick={() => fakeAction("Yêu cầu CSV — gói Pro")}
          className="justify-start"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Tải dữ liệu CSV
          <Badge variant="secondary" className="ml-auto">
            Pro
          </Badge>
        </Button>
      </div>

      <Button
        variant="secondary"
        className="w-full justify-between mb-6"
        onClick={() => navigate("/listings?propertyType=quyen-su-dung-dat")}
      >
        <span className="inline-flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Lọc cơ sở dữ liệu BĐS theo điều kiện của bạn
        </span>
        <ArrowRight className="h-4 w-4" />
      </Button>

      <div className="border-t border-border pt-5">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Đăng ký nhận báo cáo BĐS hàng tháng
          </h3>
        </div>
        <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email"
            required
            placeholder="email@cua-ban.vn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">
            <Database className="h-4 w-4" />
            Đăng ký
          </Button>
        </form>
      </div>
    </Card>
  );
};

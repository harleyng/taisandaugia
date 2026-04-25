import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Database,
  Download,
  FileSpreadsheet,
  Mail,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export const OutcomesFinalCTA = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [openSection, setOpenSection] = useState<string | null>(null);

  const fakeAction = (title: string) =>
    toast({ title, description: "Tính năng sẽ sớm có trong bản cập nhật tới." });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({
      title: "Đăng ký thành công",
      description: `Báo cáo hàng tháng sẽ gửi tới ${email}.`,
    });
    setEmail("");
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8 border-l-4 border-l-primary">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-5 w-5 text-primary" />
          <h2 className="text-base md:text-lg font-semibold text-foreground">Lấy dữ liệu này</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <Button onClick={() => fakeAction("Đang chuẩn bị PDF")} className="justify-start">
            <Download className="h-4 w-4" />
            Tải báo cáo PDF section này
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

        <div className="border-t border-border pt-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Đăng ký nhận báo cáo hàng tháng
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button asChild variant="outline">
          <Link to="/report">
            <ArrowLeft className="h-4 w-4" />
            Quay lại Báo cáo tổng quan
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Đào sâu section khác:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpenSection("Cạnh tranh & chênh lệch")}
          >
            Cạnh tranh & chênh lệch
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpenSection("Xu hướng giá")}>
            Xu hướng giá
          </Button>
        </div>
      </div>

      <Dialog open={!!openSection} onOpenChange={(o) => !o && setOpenSection(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Sắp ra mắt</DialogTitle>
            <DialogDescription className="text-center">
              Báo cáo chuyên sâu cho phần "{openSection}" đang được hoàn thiện và sẽ có mặt trong
              bản cập nhật sắp tới.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setOpenSection(null)}>Đã hiểu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

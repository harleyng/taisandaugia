import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Shield, Send } from "lucide-react";

interface Props {
  accepted: boolean;
  onAccept: (v: boolean) => void;
  onSubmit: () => void;
  disabled: boolean;
  isSubmitting: boolean;
}

export const TermsSection = ({ accepted, onAccept, onSubmit, disabled, isSubmitting }: Props) => (
  <Card className="rounded-2xl p-5 space-y-4">
    <div className="flex items-start gap-3 text-sm">
      <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
      <p className="text-muted-foreground leading-relaxed">
        Thông tin và tài liệu bạn cung cấp chỉ dùng để xác thực danh tính, được lưu trữ bảo mật theo quy định.
        Vai trò Chủ tài sản sẽ được kích hoạt sau khi hồ sơ được duyệt.
      </p>
    </div>

    <div className="flex items-start gap-3">
      <Checkbox
        id="terms"
        checked={accepted}
        onCheckedChange={(v) => onAccept(!!v)}
      />
      <Label htmlFor="terms" className="font-normal text-sm cursor-pointer leading-relaxed">
        Tôi cam kết thông tin cung cấp là trung thực, chính xác và chấp nhận{" "}
        <a href="/dieu-khoan-su-dung" target="_blank" className="text-primary hover:underline">
          Điều khoản sử dụng
        </a>{" "}
        của sàn.
      </Label>
    </div>

    <Button
      onClick={onSubmit}
      disabled={disabled || !accepted || isSubmitting}
      className="w-full gap-2"
    >
      <Send className="h-4 w-4" />
      {isSubmitting ? "Đang gửi..." : "Nộp hồ sơ xác thực"}
    </Button>
  </Card>
);

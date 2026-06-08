import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { CheckCircle2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import type { IdType } from "@/types/asset-owner";

interface Props {
  fullName: string;
  phone: string;
  phoneVerified: boolean;
  contactEmail: string;
  idType: IdType;
  idNumber: string;
  onChange: (fields: Partial<{
    full_name: string;
    phone: string;
    phone_verified: boolean;
    contact_email: string;
    id_type: IdType;
    id_number: string;
  }>) => void;
}

export const PersonalInfoSection = ({
  fullName, phone, phoneVerified, contactEmail, idType, idNumber, onChange,
}: Props) => {
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [demoCode, setDemoCode] = useState("");

  const handleSendOtp = () => {
    if (!/^0[0-9]{9}$/.test(phone)) {
      toast.error("Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu bằng 0)");
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setDemoCode(code);
    setOtpOpen(true);
    toast.info(`OTP (demo): ${code}`, { duration: 30000 });
  };

  const handleVerifyOtp = () => {
    if (otp === demoCode) {
      onChange({ phone_verified: true });
      setOtpOpen(false);
      setOtp("");
      toast.success("Xác thực số điện thoại thành công");
    } else {
      toast.error("Mã OTP không đúng");
    }
  };

  return (
    <>
      <Card className="rounded-2xl p-5 space-y-5">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">A</span>
          Thông tin cá nhân
        </h3>

        {/* Full name */}
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Họ và tên <span className="text-destructive">*</span></Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => onChange({ full_name: e.target.value })}
            placeholder="Nguyễn Văn A"
          />
        </div>

        {/* ID type */}
        <div className="space-y-2">
          <Label>Loại giấy tờ tùy thân <span className="text-destructive">*</span></Label>
          <RadioGroup
            value={idType}
            onValueChange={(v) => onChange({ id_type: v as IdType })}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="cccd" id="id_cccd" />
              <Label htmlFor="id_cccd" className="font-normal cursor-pointer">CCCD / CMND</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="passport" id="id_passport" />
              <Label htmlFor="id_passport" className="font-normal cursor-pointer">Hộ chiếu</Label>
            </div>
          </RadioGroup>
        </div>

        {/* ID number */}
        <div className="space-y-1.5">
          <Label htmlFor="id_number">
            {idType === "cccd" ? "Số CCCD / CMND" : "Số hộ chiếu"}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="id_number"
            value={idNumber}
            onChange={(e) => onChange({ id_number: e.target.value })}
            placeholder={idType === "cccd" ? "9–12 chữ số" : "≥ 6 ký tự"}
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="phone">Số điện thoại <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <Input
              id="phone"
              value={phone}
              onChange={(e) => onChange({ phone: e.target.value, phone_verified: false })}
              placeholder="0912345678"
              className="flex-1"
              readOnly={phoneVerified}
            />
            {phoneVerified ? (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 px-3">
                <CheckCircle2 className="h-4 w-4" />
                Đã xác thực
              </span>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={handleSendOtp} className="gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                Xác thực OTP
              </Button>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email liên hệ <span className="text-destructive">*</span></Label>
          <div className="flex gap-2 items-center">
            <Input
              id="email"
              type="email"
              value={contactEmail}
              onChange={(e) => onChange({ contact_email: e.target.value })}
              placeholder="name@example.com"
              className="flex-1"
            />
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>
        </div>
      </Card>

      {/* OTP Dialog */}
      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Xác thực số điện thoại</DialogTitle>
            <DialogDescription>
              Nhập mã 6 chữ số đã gửi đến {phone}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button onClick={handleVerifyOtp} disabled={otp.length < 6}>
            Xác nhận
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

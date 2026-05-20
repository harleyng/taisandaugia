import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  User, Hash, Camera, Phone, Mail, ArrowRight, Upload, CheckCircle2, AtSign,
} from "lucide-react";
import { toast } from "sonner";

interface Step3PersonalInfoProps {
  email: string;
  onNext: () => void;
  onBack: () => void;
}

type IdType = "cccd" | "passport";

const UploadZone = ({ label, icon: Icon, uploaded, onUpload }: {
  label: string;
  icon: React.ElementType;
  uploaded: boolean;
  onUpload: () => void;
}) => (
  <button
    onClick={onUpload}
    className={`w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${
      uploaded
        ? "border-green-400 bg-green-50"
        : "border-border hover:border-primary/50 hover:bg-muted/30"
    }`}
  >
    {uploaded ? (
      <>
        <CheckCircle2 className="h-6 w-6 text-green-500" />
        <span className="text-xs font-medium text-green-700">Đã tải lên</span>
      </>
    ) : (
      <>
        <Icon className="h-6 w-6 text-muted-foreground" />
        <span className="text-xs text-muted-foreground text-center">{label}</span>
        <span className="text-[11px] text-primary font-medium">Nhấn để tải lên</span>
      </>
    )}
  </button>
);

export const Step3PersonalInfo = ({ email, onNext, onBack }: Step3PersonalInfoProps) => {
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState<IdType>("cccd");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [workEmail, setWorkEmail] = useState(email);
  const [uploads, setUploads] = useState({
    idFront: false, idBack: false, selfie: false,
  });
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const handleUpload = (field: keyof typeof uploads) => {
    // Simulate upload in prototype
    setTimeout(() => {
      setUploads((p) => ({ ...p, [field]: true }));
      toast.success("Tải lên thành công (demo)");
    }, 500);
  };

  const handleSendOtp = () => {
    if (!phone.match(/^0[0-9]{9}$/)) {
      toast.error("Số điện thoại không hợp lệ");
      return;
    }
    setOtpOpen(true);
    toast.info("Đã gửi OTP đến " + phone);
  };

  const handleVerifyOtp = () => {
    if (otp.length < 6) return;
    setOtpOpen(false);
    setPhoneVerified(true);
    setOtp("");
    toast.success("Xác thực số điện thoại thành công");
  };

  const handleVerifyEmail = () => {
    if (!workEmail.includes("@") || workEmail.split("@")[1]?.split(".").length < 2) {
      toast.error("Email không hợp lệ");
      return;
    }
    // Check it's not a free email domain
    const freeDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];
    const domain = workEmail.split("@")[1]?.toLowerCase();
    if (freeDomains.includes(domain)) {
      toast.error("Vui lòng sử dụng email tên miền công ty (không phải Gmail/Yahoo...)");
      return;
    }
    setEmailVerified(true);
    toast.success("Đã gửi link xác thực đến email (demo: coi như đã xác thực)");
  };

  const canProceed =
    fullName.trim() &&
    idNumber.trim() &&
    uploads.idFront &&
    uploads.idBack &&
    uploads.selfie &&
    phoneVerified &&
    emailVerified;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-base text-foreground mb-1">Thông tin định danh người đăng ký</h3>
        <p className="text-sm text-muted-foreground">Thông tin này dùng để xác minh danh tính của bạn.</p>
      </div>

      {/* Full name */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          Họ và tên
        </Label>
        <Input placeholder="Nguyễn Văn A" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      {/* ID type + number */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
          Loại giấy tờ định danh
        </Label>
        <RadioGroup value={idType} onValueChange={(v) => setIdType(v as IdType)} className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="cccd" id="cccd" />
            <Label htmlFor="cccd" className="cursor-pointer font-normal">CCCD / CMND</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="passport" id="passport" />
            <Label htmlFor="passport" className="cursor-pointer font-normal">Hộ chiếu</Label>
          </div>
        </RadioGroup>
        <Input
          placeholder={idType === "cccd" ? "Nhập số CCCD (12 chữ số)" : "Nhập số hộ chiếu"}
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
        />
      </div>

      {/* ID photos */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Ảnh {idType === "cccd" ? "CCCD" : "Hộ chiếu"}
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <UploadZone label="Mặt trước" icon={Camera} uploaded={uploads.idFront} onUpload={() => handleUpload("idFront")} />
          <UploadZone label="Mặt sau" icon={Camera} uploaded={uploads.idBack} onUpload={() => handleUpload("idBack")} />
        </div>
      </div>

      {/* Selfie */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Ảnh selfie kèm giấy tờ</Label>
        <p className="text-xs text-muted-foreground">Chụp ảnh bạn đang cầm CCCD/Hộ chiếu, mặt rõ ràng.</p>
        <UploadZone label="Chụp selfie kèm giấy tờ" icon={Camera} uploaded={uploads.selfie} onUpload={() => handleUpload("selfie")} />
      </div>

      {/* Phone verification */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          Số điện thoại
          {phoneVerified && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="0912345678"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setPhoneVerified(false); }}
            disabled={phoneVerified}
            className="flex-1"
          />
          {!phoneVerified && (
            <Button variant="outline" size="sm" onClick={handleSendOtp} className="whitespace-nowrap">
              Gửi OTP
            </Button>
          )}
        </div>
      </div>

      {/* Work email verification */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          Email công ty
          {emailVerified && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        </Label>
        <p className="text-xs text-muted-foreground">Bắt buộc dùng email tên miền công ty (VD: ten@congty.vn)</p>
        <div className="flex gap-2">
          <Input
            placeholder="ten@congty.vn"
            type="email"
            value={workEmail}
            onChange={(e) => { setWorkEmail(e.target.value); setEmailVerified(false); }}
            disabled={emailVerified}
            className="flex-1"
          />
          {!emailVerified && (
            <Button variant="outline" size="sm" onClick={handleVerifyEmail} className="whitespace-nowrap">
              Xác thực
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Quay lại
        </Button>
        <Button onClick={onNext} disabled={!canProceed} className="flex-1">
          Tiếp tục
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>

      {/* OTP Dialog */}
      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác thực số điện thoại</DialogTitle>
            <DialogDescription>
              Nhập mã OTP 6 chữ số đã gửi đến <strong>{phone}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <p className="text-xs text-center text-muted-foreground">Prototype: nhập bất kỳ 6 chữ số nào</p>
          <Button onClick={handleVerifyOtp} disabled={otp.length < 6} className="w-full">
            Xác nhận
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

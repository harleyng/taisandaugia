import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  phone: string;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

const MOCK_OTP = "123456";
const RESEND_SECONDS = 60;

export const PhoneOtpDialog = ({ open, phone, onOpenChange, onVerified }: Props) => {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCode("");
      setSecondsLeft(RESEND_SECONDS);
    }
  }, [open]);

  // Countdown
  useEffect(() => {
    if (!open || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [open, secondsLeft]);

  const handleVerify = async (value?: string) => {
    const v = value ?? code;
    if (v.length !== 6) return;
    setVerifying(true);
    // Mock verification — match AuthDialog flow
    await new Promise((r) => setTimeout(r, 400));
    setVerifying(false);
    if (v === MOCK_OTP) {
      toast.success("Đã xác thực số điện thoại");
      onVerified();
      onOpenChange(false);
    } else {
      toast.error("Mã OTP không đúng", { description: "Dùng mã 123456 để test" });
      setCode("");
    }
  };

  const handleResend = () => {
    setSecondsLeft(RESEND_SECONDS);
    toast("Đã gửi lại mã OTP", { description: "Dùng mã 123456 để test" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Xác thực số điện thoại
          </DialogTitle>
          <DialogDescription>
            Nhập mã 6 số đã gửi đến{" "}
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Phone className="h-3.5 w-3.5" /> {phone}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => {
              setCode(v);
              if (v.length === 6) handleVerify(v);
            }}
            autoFocus
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <p className="text-xs text-muted-foreground">
            (Demo) Dùng mã <span className="font-mono font-semibold text-foreground">123456</span> để test
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={secondsLeft > 0}
          >
            {secondsLeft > 0 ? `Gửi lại sau ${secondsLeft}s` : "Gửi lại mã"}
          </Button>
          <Button onClick={() => handleVerify()} disabled={code.length !== 6 || verifying}>
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xác thực"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

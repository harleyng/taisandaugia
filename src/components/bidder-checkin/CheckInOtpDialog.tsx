import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InfoBox } from "@/components/shared/InfoBox";
import { useSelfCheckIn } from "@/hooks/useSelfCheckIn";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { BiddingRpcError, biddingErrorMessage } from "@/lib/bidding/errors";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import {
  CHECKIN_ATTENDEE_LABELS,
  type BiddingContract,
  type CheckInResult,
  type CheckinAttendee,
  type CheckinOtpResult,
} from "@/types/bidding-contract";

/**
 * Tự điểm danh phiên trực tuyến: (chọn người dự) ⇒ gửi mã ⇒ nhập mã ⇒ số báo danh.
 *
 * Sai mã không đóng dialog: lỗi hiện ngay dưới ô nhập kèm số lần còn lại
 * (attempts_left). Bị khoá / hết hạn ⇒ xoá ô nhập, chỉ còn đường "Gửi lại mã".
 * Server chặn gửi lại trong 30 giây — nút gửi lại tự đếm ngược theo đó.
 */

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;
/** Lỗi mà nhập lại mã cũ không cứu được — phải gửi mã mới. */
const NEEDS_NEW_CODE = new Set(["otp_locked", "otp_expired", "otp_missing"]);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Pick<BiddingContract, "id" | "has_proxy" | "full_name" | "proxy_full_name">;
  sessionId: string;
  /** Ẩn nút "Vào phòng đấu giá" khi đang đứng sẵn trong trang phòng. */
  inRoom?: boolean;
}

export function CheckInOtpDialog({ open, onOpenChange, contract, sessionId, inRoom }: Props) {
  const navigate = useNavigate();
  const { requestOtp, confirm } = useSelfCheckIn(contract.id);

  // Mặc định giống server: có uỷ quyền ⇒ người được uỷ quyền dự phiên.
  const [attendee, setAttendee] = useState<CheckinAttendee>(contract.has_proxy ? "proxy" : "principal");
  const [otp, setOtp] = useState<CheckinOtpResult | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const { reset: resetRequest } = requestOtp;
  const { reset: resetConfirm } = confirm;

  // Mỗi lần mở là một lượt mới; mã cũ (nếu còn hạn) vẫn dùng được nhưng không hiện lại.
  useEffect(() => {
    if (!open) return;
    setAttendee(contract.has_proxy ? "proxy" : "principal");
    setOtp(null);
    setCode("");
    setResult(null);
    resetRequest();
    resetConfirm();
  }, [open, contract.has_proxy, resetRequest, resetConfirm]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const sendCode = () =>
    requestOtp.mutate(undefined, {
      onSuccess: (r) => {
        setOtp(r);
        setCode("");
        resetConfirm();
        setCooldown(RESEND_COOLDOWN_S);
      },
      onError: (err) => {
        // Server nói còn phải chờ ⇒ đồng bộ đồng hồ đếm ngược với nó.
        if (err instanceof BiddingRpcError && err.reason === "otp_too_soon") {
          const retryAt = Date.parse(String(err.details.retry_at ?? ""));
          if (!Number.isNaN(retryAt)) setCooldown(Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)));
        }
      },
    });

  const submit = () =>
    confirm.mutate(
      { code, attendee: contract.has_proxy ? attendee : "principal" },
      {
        onSuccess: setResult,
        onError: (err) => {
          if (err instanceof BiddingRpcError && NEEDS_NEW_CODE.has(err.reason)) setCode("");
        },
      },
    );

  const confirmReason = confirm.error instanceof BiddingRpcError ? confirm.error.reason : null;
  const mustResend = confirmReason != null && NEEDS_NEW_CODE.has(confirmReason);

  const attendeeName = (a: CheckinAttendee) => (a === "proxy" ? contract.proxy_full_name : contract.full_name);

  const body = () => {
    if (result) {
      return (
        <div className="space-y-4 py-2 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <div>
            <p className="text-sm text-muted-foreground">Số báo danh của bạn</p>
            <p className="font-mono text-5xl font-bold tracking-widest text-primary">{formatBidderNo(result.bidder_no)}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {CHECKIN_ATTENDEE_LABELS[result.attendee]} dự phiên · điểm danh lúc {formatDateTime(result.checked_in_at)}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {contract.has_proxy && (
          <div className="space-y-2">
            <Label>
              Người dự phiên <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={attendee}
              onValueChange={(v) => setAttendee(v as CheckinAttendee)}
              className="space-y-1"
              disabled={!!otp}
            >
              {(["proxy", "principal"] as const).map((a) => (
                <div key={a} className="flex items-center gap-2">
                  <RadioGroupItem value={a} id={`checkin-attendee-${a}`} />
                  <Label htmlFor={`checkin-attendee-${a}`} className="font-normal">
                    {CHECKIN_ATTENDEE_LABELS[a]}
                    {attendeeName(a) && <span className="text-muted-foreground"> — {attendeeName(a)}</span>}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {!otp ? (
          <p className="text-sm text-muted-foreground">
            Mã xác nhận 6 chữ số được gửi tới số điện thoại trên hồ sơ tham gia. Mã có hiệu lực 5 phút.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Đã gửi mã tới <span className="font-medium text-foreground">{otp.sent_to}</span>, hiệu lực đến{" "}
              {new Date(otp.expires_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.
            </p>
            {otp.demo_code && (
              <InfoBox variant="amber" className="text-sm">
                Bản thử nghiệm chưa gửi SMS thật. Mã của bạn:{" "}
                <span className="font-mono text-base font-bold tracking-widest">{otp.demo_code}</span>
              </InfoBox>
            )}
            <div className="space-y-2">
              <Label>
                Mã xác nhận <span className="text-destructive">*</span>
              </Label>
              <InputOTP
                maxLength={OTP_LENGTH}
                value={code}
                onChange={(v) => {
                  setCode(v.replace(/\D/g, ""));
                  if (confirm.isError && !mustResend) resetConfirm();
                }}
                disabled={mustResend || confirm.isPending}
                inputMode="numeric"
                autoFocus
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {confirm.isError && <p className="text-sm text-destructive">{biddingErrorMessage(confirm.error)}</p>}
            </div>
          </>
        )}
      </div>
    );
  };

  const footer = () => {
    if (result) {
      return (
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          {!inRoom && <Button onClick={() => navigate(`/sessions/${sessionId}/dau-gia`)}>Vào phòng đấu giá</Button>}
        </>
      );
    }
    if (!otp) {
      return (
        <Button onClick={sendCode} disabled={requestOtp.isPending || cooldown > 0}>
          {requestOtp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {cooldown > 0 ? `Gửi mã (${cooldown}s)` : "Gửi mã xác nhận"}
        </Button>
      );
    }
    return (
      <>
        <Button variant="outline" onClick={sendCode} disabled={requestOtp.isPending || cooldown > 0}>
          {requestOtp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {cooldown > 0 ? `Gửi lại mã (${cooldown}s)` : "Gửi lại mã"}
        </Button>
        <Button onClick={submit} disabled={code.length < OTP_LENGTH || mustResend || confirm.isPending}>
          {confirm.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Điểm danh
        </Button>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{result ? "Đã điểm danh" : "Điểm danh trực tuyến"}</DialogTitle>
          {!result && (
            <DialogDescription>Xác nhận bằng mã gửi qua tin nhắn để nhận số báo danh.</DialogDescription>
          )}
        </DialogHeader>
        {body()}
        <DialogFooter className="gap-2 sm:gap-0">{footer()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

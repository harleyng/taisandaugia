import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckRow } from "@/components/buyer-contracts/ui";
import { useSelfCheckIn } from "@/hooks/useSelfCheckIn";
import { formatShortDate, formatShortDateTime } from "@/lib/auctionSessions/listBadge";
import { BiddingRpcError, biddingErrorMessage } from "@/lib/bidding/errors";
import { formatClock, maskPhone } from "@/lib/biddingContracts/attendanceTicket";
import { checkinWindowOf, type CheckinWindowSession } from "@/lib/biddingContracts/checkinWindow";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import type { BiddingContract, CheckInResult, CheckinAttendee, CheckinOtpResult } from "@/types/bidding-contract";
import { CheckinModal, ModalKv } from "./CheckinModal";

/**
 * Tự điểm danh phiên TRỰC TUYẾN (design san-checkin.js): gửi mã ⇒ nhập mã ⇒ số
 * báo danh. Nhập đủ 6 số là tự xác nhận. Sai mã giữ nguyên modal, báo còn bao
 * nhiêu lần thử (attempts_left của server); khoá / hết hạn ⇒ chỉ còn "Gửi mã mới".
 * Server chặn gửi lại trong 30 giây — đồng hồ "Gửi lại mã sau" theo đúng mốc đó.
 */

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;
/** Lỗi mà nhập lại không cứu được — phải gửi mã mới. */
const NEEDS_NEW_CODE: Record<string, [string, string]> = {
  otp_locked: ["Mã đã bị khoá", "Bạn đã nhập sai 5 lần. Gửi mã mới để thử lại."],
  otp_expired: ["Mã đã hết hạn", "Mã chỉ có hiệu lực 5 phút. Gửi mã mới để điểm danh."],
  otp_missing: ["Chưa có mã xác nhận", "Gửi mã mới để điểm danh."],
};

type Step = "send" | "otp" | "done";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Pick<BiddingContract, "id" | "code" | "phone" | "has_proxy" | "full_name" | "proxy_full_name">;
  session: CheckinWindowSession & { id: string; code: string | null };
  /** Đang đứng trong trang phòng đấu giá ⇒ không cần nút "Vào phòng". */
  inRoom?: boolean;
}

export function CheckInOtpDialog({ open, onOpenChange, contract: c, session, inRoom }: Props) {
  const navigate = useNavigate();
  const { requestOtp, confirm } = useSelfCheckIn(c.id);
  const input = useRef<HTMLInputElement>(null);

  // Mặc định giống server: có uỷ quyền ⇒ người được uỷ quyền dự phiên.
  const [attendee, setAttendee] = useState<CheckinAttendee>(c.has_proxy ? "proxy" : "principal");
  const [step, setStep] = useState<Step>("send");
  const [otp, setOtp] = useState<CheckinOtpResult | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const { reset: resetRequest } = requestOtp;
  const { reset: resetConfirm } = confirm;

  // Mỗi lần mở là một lượt mới; mã cũ (nếu còn hạn) vẫn dùng được nhưng không hiện lại.
  useEffect(() => {
    if (!open) return;
    setAttendee(c.has_proxy ? "proxy" : "principal");
    setStep("send");
    setOtp(null);
    setCode("");
    setResult(null);
    resetRequest();
    resetConfirm();
  }, [open, c.has_proxy, resetRequest, resetConfirm]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const { closesAt } = checkinWindowOf(session);
  const startsAt = new Date(session.starts_at);
  const phone = maskPhone(c.phone);
  const nameOf = (a: CheckinAttendee) => (a === "proxy" ? c.proxy_full_name || c.full_name : c.full_name);

  const sendCode = () =>
    requestOtp.mutate(undefined, {
      onSuccess: (r) => {
        setOtp(r);
        setCode("");
        resetConfirm();
        setCooldown(RESEND_COOLDOWN_S);
        setStep("otp");
        setTimeout(() => input.current?.focus(), 40);
      },
      onError: (err) => {
        // Server nói còn phải chờ ⇒ đồng bộ đồng hồ đếm ngược với nó.
        if (err instanceof BiddingRpcError && err.reason === "otp_too_soon") {
          const retryAt = Date.parse(String(err.details.retry_at ?? ""));
          if (!Number.isNaN(retryAt)) setCooldown(Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)));
          // Mã gửi lượt trước vẫn còn hạn — cho nhập luôn.
          setStep("otp");
        }
      },
    });

  const verify = (value: string) => {
    if (value.length < OTP_LENGTH || confirm.isPending) return;
    confirm.mutate(
      { code: value, attendee: c.has_proxy ? attendee : "principal" },
      {
        onSuccess: (r) => {
          setResult(r);
          setStep("done");
        },
        onError: () => {
          setCode("");
          setTimeout(() => input.current?.focus(), 0);
        },
      },
    );
  };

  const reason = confirm.error instanceof BiddingRpcError ? confirm.error.reason : null;
  const blocked = reason ? NEEDS_NEW_CODE[reason] : undefined;
  const errorText = (() => {
    if (!confirm.error || blocked) return "";
    if (reason === "otp_invalid" && confirm.error instanceof BiddingRpcError) {
      const left = Number(confirm.error.details.attempts_left);
      if (Number.isFinite(left)) return `Mã không đúng — còn ${left} lần thử.`;
    }
    return biddingErrorMessage(confirm.error);
  })();

  if (step === "done" && result) {
    const started = Date.now() >= startsAt.getTime();
    return (
      <CheckinModal open={open} onOpenChange={onOpenChange} title="">
        <div className="flex flex-col items-center gap-0.5 pb-0.5 pt-1.5 text-center">
          <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <Check className="h-6 w-6 text-success" strokeWidth={2.5} />
          </span>
          <h3 className="text-lg font-semibold text-foreground">Điểm danh thành công</h3>
          <span className="mt-2 text-xs text-muted-foreground">Số báo danh của bạn</span>
          <b className="my-1 font-mono text-[64px] font-bold leading-[1.05] tracking-[.08em] text-primary">
            {formatBidderNo(result.bidder_no)}
          </b>
          <span className="text-xs text-muted-foreground">
            {nameOf(result.attendee)} · {result.attendee === "proxy" ? "người được uỷ quyền" : "chính chủ"} ·{" "}
            {formatShortDateTime(result.checked_in_at)}
          </span>
        </div>
        {started ? (
          !inRoom && (
            <Button
              className="h-11 w-full text-[15px] font-semibold"
              onClick={() => navigate(`/sessions/${session.id}/dau-gia`)}
            >
              Vào phòng đấu giá
            </Button>
          )
        ) : (
          <div className="rounded-xl bg-primary/[.06] p-3 text-[13px] text-foreground">
            Phòng đấu giá mở lúc{" "}
            <b>
              {formatClock(startsAt)} {formatShortDate(session.starts_at)}
            </b>
          </div>
        )}
        <Button
          className="h-11 w-full text-[15px] font-semibold"
          variant={started && !inRoom ? "ghost" : "default"}
          onClick={() => onOpenChange(false)}
        >
          Xong
        </Button>
      </CheckinModal>
    );
  }

  if (step === "otp") {
    return (
      <CheckinModal
        open={open}
        onOpenChange={onOpenChange}
        title="Nhập mã xác nhận"
        sub={`Mã 6 số đã gửi tới ${phone} · hiệu lực 5 phút`}
      >
        {blocked ? (
          <>
            <div className="rounded-xl bg-accent/20 p-3 text-[13px] text-[hsl(var(--tier-warn-fg))]">
              <b>{blocked[0]}</b>
              <br />
              {blocked[1]}
            </div>
            <Button
              className="h-11 w-full text-[15px] font-semibold"
              disabled={requestOtp.isPending || cooldown > 0}
              onClick={sendCode}
            >
              {requestOtp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {cooldown > 0 ? `Gửi mã mới sau 00:${String(cooldown).padStart(2, "0")}` : "Gửi mã mới"}
            </Button>
          </>
        ) : (
          <>
            <input
              ref={input}
              className={cn(
                "h-14 w-full rounded-xl border-0 bg-muted pl-[.5em] text-center font-mono text-[26px] font-bold tracking-[.5em] text-foreground outline-none focus:bg-card focus:outline-2 focus:outline-offset-1 focus:outline-primary",
                errorText && "bg-card outline-2 outline-destructive focus:outline-destructive",
              )}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              value={code}
              disabled={confirm.isPending}
              aria-label="Mã xác nhận"
              aria-invalid={!!errorText}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
                setCode(v);
                if (confirm.isError) resetConfirm();
                if (v.length === OTP_LENGTH) verify(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") verify(code);
              }}
            />
            {errorText && <p className="-mt-1.5 text-[13px] font-medium text-destructive">{errorText}</p>}
            <div className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
              {cooldown > 0 ? (
                <span>Gửi lại mã sau 00:{String(cooldown).padStart(2, "0")}</span>
              ) : (
                <button
                  type="button"
                  className="font-medium text-primary hover:underline disabled:opacity-60"
                  disabled={requestOtp.isPending}
                  onClick={sendCode}
                >
                  Gửi lại mã
                </button>
              )}
              {otp?.demo_code && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
                  Demo · mã <b className="font-mono tracking-[.1em]">{otp.demo_code}</b>
                </span>
              )}
            </div>
            <Button
              className="h-11 w-full text-[15px] font-semibold"
              disabled={code.length < OTP_LENGTH || confirm.isPending}
              onClick={() => verify(code)}
            >
              {confirm.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Xác nhận điểm danh
            </Button>
          </>
        )}
      </CheckinModal>
    );
  }

  return (
    <CheckinModal
      open={open}
      onOpenChange={onOpenChange}
      title="Điểm danh trực tuyến"
      sub={`${session.code ? `${session.code} · ` : ""}đóng lúc ${formatClock(closesAt)}`}
    >
      <ModalKv
        rows={[
          { label: "Hồ sơ", value: <span className="font-mono">{c.code}</span> },
          ...(c.has_proxy ? [] : [{ label: "Người dự phiên", value: <b>{c.full_name}</b> }]),
          { label: "Nhận mã qua SMS", value: <span className="font-mono">{phone}</span> },
        ]}
      />
      {c.has_proxy && (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Người dự phiên">
          <span className="text-[13px] font-medium text-foreground">
            Người dự phiên <span className="text-destructive">*</span>
          </span>
          {(["proxy", "principal"] as const).map((a) => (
            <CheckRow key={a} radio checked={attendee === a} onToggle={() => setAttendee(a)}>
              <b className="block text-sm font-semibold">{nameOf(a)}</b>
              <span className="text-xs text-muted-foreground">
                {a === "proxy" ? "Người được uỷ quyền" : "Người đăng ký"}
              </span>
            </CheckRow>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Điểm danh xong, bạn nhận <b className="text-foreground">số báo danh</b> cấp ngẫu nhiên để trả giá trong phòng
        đấu giá. Số này không đổi trong suốt phiên.
      </p>
      <div className="flex flex-col gap-2">
        <Button
          className="h-11 w-full text-[15px] font-semibold"
          disabled={requestOtp.isPending || cooldown > 0}
          onClick={sendCode}
        >
          {requestOtp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {cooldown > 0 ? `Gửi mã xác nhận (${cooldown}s)` : "Gửi mã xác nhận"}
        </Button>
        <Button
          variant="ghost"
          className="h-10 w-full text-muted-foreground hover:text-foreground"
          onClick={() => onOpenChange(false)}
        >
          Để sau
        </Button>
      </div>
    </CheckinModal>
  );
}

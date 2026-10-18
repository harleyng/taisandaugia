import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useCancelBiddingContract, useStartBiddingContract } from "@/hooks/useBiddingContracts";
import { useMySessionOpenWatch, useUnwatchSessionOpen } from "@/hooks/usePublicSessionPage";
import { countdownParts, type JourneyPhase } from "@/lib/auctionSessions/buyerJourney";
import { formatShortDateTime } from "@/lib/auctionSessions/listBadge";
import { contractToRegistrationPayload } from "@/lib/biddingContracts/registrationPayload";
import { contractCheckoutPath, sessionRegistrationPath } from "@/lib/biddingContracts/paths";
import { formatMoneyFull } from "@/utils/money";
import type { PublicSessionDetail } from "@/types/auction-session";
import type { BiddingContract, ContractSummary } from "@/types/bidding-contract";
import { Countdown, KvBox, Note } from "../ui";
import { BTN } from "../buttonStyles";
import { WatchOpenDialog } from "./WatchOpenDialog";

interface Props {
  phase: Extract<JourneyPhase, "not_open_yet" | "available" | "pending_payment" | "full" | "closed" | "offline">;
  session: PublicSessionDetail;
  contract: BiddingContract | null;
  summary: ContractSummary | null;
  now: Date;
}

/** Bước 1 "Mua hồ sơ": chưa mở bán / đang bán / chờ thanh toán / hết suất / hết hạn / không bán qua sàn. */
export function PurchaseBody({ phase, session, contract, summary, now }: Props) {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const start = useStartBiddingContract();
  const cancel = useCancelBiddingContract();
  const { data: watch } = useMySessionOpenWatch(phase === "not_open_yet" ? session.id : null);
  const unwatch = useUnwatchSessionOpen(session.id);
  const [watchOpen, setWatchOpen] = useState(false);

  switch (phase) {
    case "not_open_yet": {
      const opensAt = session.registration_start_at as string;
      const watching = watch && !watch.notified_at;
      return (
        <>
          <Countdown
            caption={`Mở bán lúc ${formatShortDateTime(opensAt)}`}
            parts={countdownParts(Date.parse(opensAt), now.getTime())}
          />
          {watching ? (
            <>
              <Note>
                Sẽ gửi email tới <b className="text-foreground">{watch.email}</b> khi phiên mở bán hồ sơ.
              </Note>
              <Button className={BTN.ghost} disabled={unwatch.isPending} onClick={() => unwatch.mutate()}>
                Huỷ nhận email
              </Button>
            </>
          ) : (
            <Button
              className={BTN.soft}
              onClick={() => (userId ? setWatchOpen(true) : openAuthDialog(() => setWatchOpen(true)))}
            >
              Nhận thông báo khi mở bán
            </Button>
          )}
          <WatchOpenDialog
            open={watchOpen}
            onOpenChange={setWatchOpen}
            sessionId={session.id}
            sessionTitle={session.title}
            opensAt={opensAt}
            currentEmail={watch?.email}
          />
        </>
      );
    }

    case "available": {
      const max = session.max_registrants;
      const taken = summary ? summary.paid_count + summary.held_count : null;
      const register = () => navigate(sessionRegistrationPath(session.id));
      return (
        <>
          <KvBox
            rows={[
              {
                label: "Giá hồ sơ",
                value: <b className="text-lg">{formatMoneyFull(session.dossier_fee)}</b>,
              },
              ...(max != null && taken != null
                ? [
                    {
                      label: "Đã đăng ký",
                      value: (
                        <>
                          {summary?.paid_count}/{max} · <b>còn {Math.max(0, max - taken)} suất</b>
                        </>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          {session.registration_end_at && (
            <Countdown
              caption={`Hạn mua hồ sơ: ${formatShortDateTime(session.registration_end_at)}`}
              parts={countdownParts(Date.parse(session.registration_end_at), now.getTime())}
            />
          )}
          <Button className={BTN.primaryLg} onClick={() => (userId ? register() : openAuthDialog(register))}>
            Mua hồ sơ tham gia
          </Button>
        </>
      );
    }

    case "pending_payment": {
      // Gia hạn giữ chỗ bằng chính bản chụp đã nộp (kể cả ảnh giấy tờ), rồi sang trang thanh toán.
      const continuePayment = () => {
        if (!contract) return;
        start.mutate(
          { sessionId: session.id, payload: contractToRegistrationPayload(contract) },
          { onSuccess: (r) => navigate(contractCheckoutPath(r.contract_id, session.id)) },
        );
      };
      const busy = start.isPending || cancel.isPending;
      return (
        <>
          <KvBox
            rows={[
              { label: "Mã hồ sơ", value: <span className="font-mono">{contract?.code}</span> },
              { label: "Giá hồ sơ", value: <b>{formatMoneyFull(contract?.fee_amount ?? session.dossier_fee)}</b> },
            ]}
          />
          <p className="m-0 text-xs text-muted-foreground">Hồ sơ đang chờ thanh toán — chỗ của bạn được giữ trong thời gian ngắn.</p>
          <Button className={`${BTN.primaryLg} gap-1.5`} onClick={continuePayment} disabled={busy}>
            {start.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tiếp tục thanh toán
          </Button>
          <Button className={BTN.ghost} onClick={() => contract && cancel.mutate(contract.id)} disabled={busy}>
            Huỷ hồ sơ
          </Button>
        </>
      );
    }

    case "full":
      return <Note>Phiên đã đủ số người đăng ký.</Note>;

    case "closed":
      return <Note>Đã hết thời gian bán hồ sơ.</Note>;

    default: {
      const org = session.auction_organizations;
      return (
        <>
          <Note>Tổ chức chưa bán hồ sơ trực tuyến cho phiên này. Mua và nộp hồ sơ trực tiếp tại tổ chức.</Note>
          <KvBox
            rows={[
              ...(org?.address ? [{ label: "Địa chỉ", value: org.address }] : []),
              ...(org?.phone
                ? [{ label: "Điện thoại", value: <a href={`tel:${org.phone.replace(/\s/g, "")}`} className="text-primary">{org.phone}</a> }]
                : []),
              ...(session.registration_end_at
                ? [{ label: "Hạn nhận hồ sơ", value: formatShortDateTime(session.registration_end_at) }]
                : []),
            ]}
          />
          {org?.phone && (
            <Button className={BTN.soft} onClick={() => (window.location.href = `tel:${org.phone?.replace(/\s/g, "")}`)}>
              Gọi tổ chức
            </Button>
          )}
        </>
      );
    }
  }
}

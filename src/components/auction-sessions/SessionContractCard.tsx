import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSignature, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/shared/InfoBox";
import { InfoCardShell } from "@/components/shared/InfoCardShell";
import { DepositStatusBadge } from "@/components/bidding-contracts/DepositStatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import {
  useCancelBiddingContract,
  useMySessionContract,
  useSessionContractSummary,
  useStartBiddingContract,
} from "@/hooks/useBiddingContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { contractCtaState } from "@/lib/biddingContracts/ctaState";
import { identityDefaults, identityToRpcArgs } from "@/lib/biddingContracts/identityForm";
import { contractCheckoutPath, formatBidderNo, MY_CONTRACTS_PATH } from "@/lib/biddingContracts/paths";
import type { PublicSessionDetail } from "@/types/auction-session";
import { BuyContractDialog } from "./BuyContractDialog";

/** Cột phải trang /sessions/:id — mua hồ sơ tham gia hoặc xem hồ sơ đã mua. */
export function SessionContractCard({ session }: { session: PublicSessionDetail }) {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const { data: summary } = useSessionContractSummary(session.id);
  const { data: contract, isLoading: contractLoading } = useMySessionContract(session.id);
  const start = useStartBiddingContract();
  const cancel = useCancelBiddingContract();
  const [buyOpen, setBuyOpen] = useState(false);

  const cta = contractCtaState({ session, contract: contract ?? null, summary: summary ?? null, userId });
  const fee = session.dossier_fee ?? 0;

  // Phiên huỷ đã có banner riêng; phiên không bán qua sàn thì không chiếm chỗ.
  if (cta.kind === "cancelled_session") return null;
  if (cta.kind === "not_for_sale" && fee <= 0) return null;

  // Gia hạn giữ chỗ bằng chính danh tính đã khai, rồi sang trang thanh toán.
  const continuePayment = () => {
    if (!contract) return;
    start.mutate(identityToRpcArgs(session.id, { ...identityDefaults({ last: contract }), consent: true }), {
      onSuccess: (r) => navigate(contractCheckoutPath(r.contract_id, session.id)),
    });
  };

  const muted = (text: string) => <p className="text-sm text-muted-foreground">{text}</p>;

  const body = () => {
    if (userId && contractLoading) {
      return (
        <Button className="w-full" disabled>
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      );
    }
    switch (cta.kind) {
      case "paid":
        return (
          <div className="space-y-3">
            <div className="space-y-2 rounded-xl bg-primary/5 p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Mã hồ sơ</span>
                <span className="font-mono font-medium text-foreground">{contract?.code}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Số báo danh</span>
                <span className="font-semibold text-foreground">{formatBidderNo(contract?.bidder_no) ?? "Chưa cấp"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Tiền đặt trước</span>
                {contract && <DepositStatusBadge status={contract.deposit_status} />}
              </div>
            </div>
            {session.status === "cancelled" ? (
              <InfoBox variant="amber" className="text-sm">
                Phiên đã huỷ — tổ chức đấu giá sẽ liên hệ hoàn trả tiền đặt trước.
              </InfoBox>
            ) : (
              contract?.deposit_status === "pending" &&
              muted("Nộp tiền đặt trước theo hướng dẫn của tổ chức đấu giá. Sau khi tổ chức xác nhận, bạn được cấp số báo danh.")
            )}
            <Button variant="outline" className="w-full" onClick={() => navigate(MY_CONTRACTS_PATH)}>
              Xem hồ sơ của tôi
            </Button>
          </div>
        );
      case "pending":
        return (
          <div className="space-y-2">
            {muted(`Hồ sơ ${contract?.code ?? ""} đang chờ thanh toán.`)}
            <Button className="w-full gap-1.5" onClick={continuePayment} disabled={start.isPending || cancel.isPending}>
              {start.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Tiếp tục thanh toán
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => contract && cancel.mutate(contract.id)}
              disabled={start.isPending || cancel.isPending}
            >
              Huỷ hồ sơ
            </Button>
          </div>
        );
      case "available":
      case "login_required":
        return (
          <div className="space-y-2">
            <Button
              className="h-11 w-full text-base font-semibold"
              onClick={() => (userId ? setBuyOpen(true) : openAuthDialog(() => setBuyOpen(true)))}
            >
              {userId ? "Mua hồ sơ tham gia" : "Đăng nhập để mua hồ sơ"}
            </Button>
            {session.registration_end_at && muted(`Hạn mua hồ sơ: ${formatDateTime(session.registration_end_at)}`)}
          </div>
        );
      case "not_open_yet":
        return (
          <InfoBox variant="amber" className="text-sm">
            Mở bán hồ sơ từ {formatDateTime(cta.opensAt)}.
          </InfoBox>
        );
      case "full":
        return muted("Phiên đã đủ số người đăng ký.");
      case "closed":
        return muted("Đã hết thời gian bán hồ sơ.");
      default:
        return muted("Tổ chức chưa mở bán hồ sơ trực tuyến cho phiên này. Vui lòng liên hệ trực tiếp tổ chức đấu giá.");
    }
  };

  return (
    <InfoCardShell
      title="Hồ sơ tham gia"
      icon={<FileSignature className="h-5 w-5 text-foreground" />}
      bodyClassName="space-y-4"
    >
      {fee > 0 && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted-foreground">Giá hồ sơ</span>
          <span className="text-xl font-bold text-primary">{formatVnd(fee)}</span>
        </div>
      )}
      {session.max_registrants != null && summary && (
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Đã đăng ký</span>
          <span className="font-medium text-foreground">
            {summary.paid_count}/{session.max_registrants}
          </span>
        </div>
      )}
      {body()}

      <BuyContractDialog
        session={session}
        open={buyOpen && (cta.kind === "available" || cta.kind === "login_required")}
        onOpenChange={setBuyOpen}
      />
    </InfoCardShell>
  );
}

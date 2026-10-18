import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, Loader2, ShieldAlert } from "lucide-react";
import { ConsignmentCanvas } from "@/components/portal/consignment/ConsignmentCanvas";
import { ApproveDialog } from "@/components/portal/bidding-contracts/detail/ApproveDialog";
import { ApplicantCard, LotsCard } from "@/components/portal/bidding-contracts/detail/ContractInfoCards";
import { ContractBanner, ContractHero } from "@/components/portal/bidding-contracts/detail/ContractHero";
import { DepositCard, HistoryCard } from "@/components/portal/bidding-contracts/detail/ContractSideCards";
import { DecisionDialog, type NoteDecision } from "@/components/portal/bidding-contracts/detail/DecisionDialog";
import { DepositDialog } from "@/components/portal/bidding-contracts/detail/DepositDialog";
import { DocumentsCard } from "@/components/portal/bidding-contracts/detail/DocumentsCard";
import { useContractLotIds } from "@/hooks/useBuyerContracts";
import { useAuctionSession } from "@/hooks/useAuctionSessions";
import { useSessionContractByCode } from "@/hooks/useOrgBiddingContracts";
import { useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";
import { contractDocuments, isRejected } from "@/lib/biddingContracts/contractDetail";
import { expectedDeposit } from "@/lib/biddingContracts/filters";
import { sessionContractsPath, type ContractDetailState } from "@/lib/biddingContracts/paths";
import type { ReviewDecision } from "@/types/bidding-contract";

const LIST = "/portal/phien-dau-gia";
/** ?ghi-nhan=dat-truoc — mở sẵn hộp thoại tiền đặt trước (nút "Ghi nhận đặt trước" ở bảng). */
const DEPOSIT_PARAM = "ghi-nhan";

function Crumb({ sessionId, sessionCode, code }: { sessionId?: string; sessionCode?: string | null; code?: string }) {
  // Mở từ menu "Hồ sơ tham gia" ⇒ đường dẫn quay về đúng danh sách đó (giữ bộ lọc), như design.
  const fromList = (useLocation().state as ContractDetailState | null)?.fromList;
  const sep = <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  return (
    <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
      {fromList ? (
        <Link to={fromList} className="shrink-0 hover:text-foreground">
          Hồ sơ tham gia
        </Link>
      ) : (
        <Link to={LIST} className="shrink-0 hover:text-foreground">
          Phiên đấu giá
        </Link>
      )}
      {sessionId && !fromList && (
        <>
          {sep}
          <Link to={`${LIST}/${sessionId}`} className="shrink-0 hover:text-foreground">
            {sessionCode ?? "Phiên"}
          </Link>
          {sep}
          <Link to={sessionContractsPath(sessionId)} className="shrink-0 hover:text-foreground">
            Hồ sơ tham gia
          </Link>
        </>
      )}
      {code && (
        <>
          {sep}
          <span className="truncate font-semibold text-foreground">{code}</span>
        </>
      )}
    </nav>
  );
}

function StateBox({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-card">{children}</div>
  );
}

/**
 * /portal/phien-dau-gia/:id/ho-so/:code — chi tiết một hồ sơ tham gia (design
 * pdg-hoso.js), thay cho ContractReviewSheet. Mở từ tab "Hồ sơ tham gia", menu
 * "Hồ sơ tham gia" (/portal/ho-so-tham-gia) và "Xem hồ sơ gốc" ở tab Điểm danh.
 *
 * Quyền xét theo TỔ CHỨC CỦA HỒ SƠ (useHasOrgPermissionIn), không theo tổ chức đang
 * chọn — link có thể mở từ tổ chức khác của cùng người dùng.
 */
export default function HoSoThamGiaDetailPage() {
  const { id, code } = useParams<{ id: string; code: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: session, isLoading: sessionLoading } = useAuctionSession(id);
  const { data: contract, isLoading, error } = useSessionContractByCode(id, code);
  const { data: lotIds } = useContractLotIds(contract?.id);
  const canReview = useHasOrgPermissionIn(contract?.organization_id, "ho-so-tham-gia", "review");
  const canUpdate = useHasOrgPermissionIn(contract?.organization_id, "ho-so-tham-gia", "update");
  const [noteDecision, setNoteDecision] = useState<NoteDecision | null>(null);
  const [approving, setApproving] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  // Mở hộp thoại tiền đặt trước một lần rồi gỡ tham số khỏi URL.
  const wantDeposit = searchParams.get(DEPOSIT_PARAM) === "dat-truoc";
  useEffect(() => {
    if (!wantDeposit || !contract) return;
    if (canUpdate && !isRejected(contract)) setDepositOpen(true);
    setSearchParams(
      (p) => {
        p.delete(DEPOSIT_PARAM);
        return p;
      },
      { replace: true },
    );
  }, [wantDeposit, contract, canUpdate, setSearchParams]);

  if (isLoading || sessionLoading) {
    return (
      <ConsignmentCanvas>
        <Crumb sessionId={id} code={code} />
        <StateBox>
          <p className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải hồ sơ…
          </p>
        </StateBox>
      </ConsignmentCanvas>
    );
  }

  if (error || !contract) {
    return (
      <ConsignmentCanvas>
        <Crumb sessionId={id} sessionCode={session?.code} code={code} />
        <StateBox>
          <ShieldAlert className="mx-auto h-9 w-9" />
          <p>Không tìm thấy hồ sơ, hoặc bạn không có quyền xem hồ sơ này.</p>
        </StateBox>
      </ConsignmentCanvas>
    );
  }

  // Người mua chọn lô khi mua hồ sơ (20261018160000); không chọn = mọi lô.
  const picked = new Set(lotIds ?? []);
  const allItems = session?.auction_session_items ?? [];
  const items = picked.size > 0 ? allItems.filter((i) => picked.has(i.id)) : allItems;
  const required = expectedDeposit(items);
  const deadline = session?.registration_end_at ?? null;
  const docs = contractDocuments(contract);
  const onDecide = (d: ReviewDecision) => (d === "approved" ? setApproving(true) : setNoteDecision(d));

  return (
    <ConsignmentCanvas>
      <Crumb sessionId={contract.session_id} sessionCode={contract.auction_sessions?.code} code={contract.code} />
      <ContractHero contract={contract} lotCount={items.length} canReview={canReview} onDecide={onDecide} />
      <ContractBanner contract={contract} deadline={deadline} />

      <div className="grid items-start gap-5 min-[1150px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ApplicantCard contract={contract} />
          {/* Ảnh chỉ đọc được khi hồ sơ còn 'paid' (can_read_buyer_kyc_object). */}
          <DocumentsCard docs={docs} showFiles={contract.status === "paid"} />
          <LotsCard items={items} required={required} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <DepositCard
            contract={contract}
            required={required}
            deadline={deadline}
            canUpdate={canUpdate}
            onEdit={() => setDepositOpen(true)}
          />
          <HistoryCard contract={contract} />
        </div>
      </div>

      <DecisionDialog contract={contract} decision={noteDecision} onOpenChange={(o) => !o && setNoteDecision(null)} />
      <ApproveDialog contract={contract} required={required} open={approving} onOpenChange={setApproving} />
      {canUpdate && (
        <DepositDialog contract={contract} required={required} open={depositOpen} onOpenChange={setDepositOpen} />
      )}
    </ConsignmentCanvas>
  );
}

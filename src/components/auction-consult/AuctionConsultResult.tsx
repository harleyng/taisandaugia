import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Info, Loader2 } from "lucide-react";
import { useAuctionConsultProposal } from "@/hooks/useAuctionConsultations";
import type { AuctionConsultation } from "@/types/auctionConsult";
import { AuctionConsultDecisionBar } from "./AuctionConsultDecisionBar";
import { AuctionConsultProposalView } from "./AuctionConsultProposalView";

const when = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm, dd/MM/yyyy", { locale: vi }) : "—");

/** Một phiên bản đề xuất: người tư vấn + thời điểm, đủ tham số, quyết định của người bán. */
export function AuctionConsultResult({
  row,
  mode,
  compact,
}: {
  row: AuctionConsultation;
  mode: "owner" | "admin";
  compact?: boolean;
}) {
  const { data: proposal, isLoading } = useAuctionConsultProposal(row.id);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Đề xuất phương án · phiên bản {row.version}
          {row.status === "superseded" && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(đã thay thế)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.code} · hoàn tất {when(row.completed_at)} · chuyên gia {row.expert_name} ({row.partner_name})
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải phương án…
        </div>
      ) : proposal ? (
        <AuctionConsultProposalView proposal={proposal} />
      ) : (
        <p className="text-sm text-muted-foreground">Không tải được phương án.</p>
      )}

      {!compact && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Đề xuất mang tính tư vấn, không tự thay đổi cấu hình phiên đấu giá — tổ chức đấu giá lập phiên chính thức.
        </p>
      )}

      <AuctionConsultDecisionBar row={row} mode={mode} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { AlertCircle, FileCheck2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuctionConsultProposal } from "@/hooks/useAuctionConsultations";
import { useSaveAuctionConsultProposal } from "@/hooks/useAdminAuctionConsultations";
import { tvdgReasonMessage } from "@/lib/auctionConsult/errors";
import { draftToValues, proposalToDraft, validateProposal } from "@/lib/auctionConsult/proposal";
import type { AuctionConsultation, ProposalDraft } from "@/types/auctionConsult";
import { CompleteAuctionConsultDialog } from "./CompleteAuctionConsultDialog";
import { ProposalFieldNotes } from "./ProposalFieldNotes";
import { ProposalFormatFields } from "./ProposalFormatFields";
import { ProposalPriceFields } from "./ProposalPriceFields";

/**
 * Soạn phương án khi yêu cầu đang ở "Đang xây dựng phương án": nạp nháp đã lưu (hoặc gợi ý
 * từ bản chụp hồ sơ), lưu nháp, hoàn tất. Nháp không lộ cho người bán (RLS).
 */
export function ProposalEditor({ row, canUpdate }: { row: AuctionConsultation; canUpdate: boolean }) {
  const { data: saved, isLoading, isFetched } = useAuctionConsultProposal(row.id);
  const save = useSaveAuctionConsultProposal();
  const [draft, setDraft] = useState<ProposalDraft | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);

  // Nạp một lần khi dữ liệu về — không ghi đè nháp đang soạn mỗi lần refetch.
  useEffect(() => {
    if (isFetched && draft === null) setDraft(proposalToDraft(saved, row));
  }, [isFetched, saved, draft, row]);

  if (isLoading || draft === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải phương án…
      </div>
    );
  }
  if (!canUpdate) {
    return <p className="text-sm text-muted-foreground">Đang xây dựng phương án — cần quyền cập nhật để soạn.</p>;
  }

  const update = (patch: Partial<ProposalDraft>) => setDraft((cur) => ({ ...(cur as ProposalDraft), ...patch }));
  const draftIssue = validateProposal(draftToValues(draft), false);

  return (
    <div className="space-y-5">
      <div className="grid gap-6 lg:grid-cols-2">
        <ProposalFormatFields draft={draft} onChange={update} disabled={save.isPending} />
        <ProposalPriceFields draft={draft} onChange={update} row={row} disabled={save.isPending} />
      </div>
      <ProposalFieldNotes draft={draft} onChange={update} disabled={save.isPending} />

      {draftIssue && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {tvdgReasonMessage(draftIssue)}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          disabled={!!draftIssue || save.isPending}
          onClick={() => save.mutate({ id: row.id, draft })}
        >
          {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Lưu nháp
        </Button>
        <Button size="sm" disabled={save.isPending} onClick={() => setCompleteOpen(true)}>
          <FileCheck2 className="mr-1.5 h-4 w-4" /> Hoàn tất & gửi đề xuất
        </Button>
      </div>

      <CompleteAuctionConsultDialog row={row} draft={draft} open={completeOpen} onOpenChange={setCompleteOpen} />
    </div>
  );
}

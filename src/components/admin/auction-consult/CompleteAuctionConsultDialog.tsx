import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuctionConsultProposalView } from "@/components/auction-consult/AuctionConsultProposalView";
import { useCompleteAuctionConsult } from "@/hooks/useAdminAuctionConsultations";
import { tvdgReasonMessage } from "@/lib/auctionConsult/errors";
import { draftToValues, validateProposal } from "@/lib/auctionConsult/proposal";
import type { AuctionConsultation, ProposalDraft } from "@/types/auctionConsult";

/**
 * Hoàn tất THAY chuyên gia: xem lại đúng những gì người bán sẽ thấy rồi gửi. Server gán phiên
 * bản, đặt đề xuất cũ thành "Phiên bản cũ" và ghi hoa hồng. KHÔNG đổi cấu hình phiên (BR-CNS-04).
 */
export function CompleteAuctionConsultDialog({
  row,
  draft,
  open,
  onOpenChange,
}: {
  row: AuctionConsultation;
  draft: ProposalDraft;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const complete = useCompleteAuctionConsult();
  const values = draftToValues(draft);
  const issue = validateProposal(values, true);

  return (
    <Dialog open={open} onOpenChange={(v) => !complete.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gửi đề xuất phương án · {row.code}</DialogTitle>
          <DialogDescription>
            Người bán sẽ thấy đủ các tham số dưới đây kèm tên chuyên gia {row.expert_name}. Đề xuất được lưu thành một phiên
            bản mới và không sửa được sau khi gửi.
          </DialogDescription>
        </DialogHeader>

        {issue ? (
          <p className="flex items-start gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {tvdgReasonMessage(issue)}
          </p>
        ) : (
          <div className="rounded-xl border border-border p-3">
            <AuctionConsultProposalView proposal={values} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={complete.isPending}>
            Quay lại
          </Button>
          <Button
            disabled={!!issue || complete.isPending}
            onClick={() => complete.mutate({ id: row.id, draft }, { onSuccess: () => onOpenChange(false) })}
          >
            {complete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi đề xuất cho người bán
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

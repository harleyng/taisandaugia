import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import { useExcuseAbsence } from "@/hooks/useOrgBiddingContracts";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { DEPOSIT_STATUS_LABELS, type ContractWithSession } from "@/types/bidding-contract";

/** org_excuse_absence đòi lý do ≥ 3 ký tự sau khi trim (reason_required). */
const MIN_REASON = 3;

interface Props {
  contract: ContractWithSession | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Miễn trừ vắng mặt (F1-b — GIẢ ĐỊNH chưa chốt): người vắng có lý do chính đáng
 * ⇒ tiền đặt trước từ "Không hoàn trả" sang "Chờ hoàn trả". Không cấp số báo
 * danh, không cho vào phòng — chỉ đổi số phận tiền đặt trước.
 */
export function ExcuseAbsenceDialog({ contract, onOpenChange }: Props) {
  const excuse = useExcuseAbsence();
  const [note, setNote] = useState("");
  const valid = note.trim().length >= MIN_REASON;

  useEffect(() => {
    if (contract) setNote("");
  }, [contract]);

  const close = (open: boolean) => {
    if (!open && excuse.isPending) return;
    onOpenChange(open);
  };

  const submit = () =>
    contract &&
    excuse.mutate({ contractId: contract.id, note: note.trim() }, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={!!contract} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Miễn trừ vắng mặt</DialogTitle>
          <DialogDescription>
            {contract?.org_name ?? contract?.full_name} · <span className="font-mono">{contract?.code}</span>
            {contract?.absent_at && <> · ghi vắng {formatDateTime(contract.absent_at)}</>}
          </DialogDescription>
        </DialogHeader>

        <InfoBox variant="amber" className="text-sm">
          Tiền đặt trước chuyển từ “{DEPOSIT_STATUS_LABELS.forfeited}” sang “{DEPOSIT_STATUS_LABELS.pending_refund}”.
          Người tham gia vẫn là vắng mặt: không có số báo danh và không vào phòng đấu giá. Không hoàn tác được.
        </InfoBox>

        <div className="space-y-1.5">
          <Label htmlFor="excuse-note">
            Lý do miễn trừ <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="excuse-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Ốm đột xuất có giấy xác nhận của cơ sở y tế, sự kiện bất khả kháng…"
          />
          <p className="text-xs text-muted-foreground">Lý do được lưu vào sổ tiền đặt trước của hồ sơ.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={excuse.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={!valid || excuse.isPending} className="gap-1.5">
            {excuse.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Miễn trừ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

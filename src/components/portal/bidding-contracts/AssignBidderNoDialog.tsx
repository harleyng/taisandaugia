import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { useAssignBidderNo } from "@/hooks/useOrgBiddingContracts";
import type { ContractWithSession } from "@/types/bidding-contract";

interface Props {
  contract: ContractWithSession | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * ĐỔI số báo danh của người đã điểm danh (org_assign_bidder_no đòi checked_in_at).
 * Số đầu tiên chỉ sinh ra lúc điểm danh — không còn "cấp số" từ màn này.
 */
export function AssignBidderNoDialog({ contract, onOpenChange }: Props) {
  const assign = useAssignBidderNo();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (contract) setValue(contract.bidder_no != null ? String(contract.bidder_no) : "");
  }, [contract]);

  const submit = () => {
    if (!contract) return;
    assign.mutate({ contractId: contract.id, bidderNo: Number(value) }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={!!contract} onOpenChange={(v) => !assign.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Đổi số báo danh</DialogTitle>
          <DialogDescription>
            {contract?.code} · {contract?.full_name}. Số báo danh không trùng trong cùng phiên.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-1">
          <Label>
            Số báo danh mới <span className="text-destructive">*</span>
          </Label>
          <NumberInput value={value} onChange={setValue} allowDecimal={false} />
        </div>

        <DialogFooter>
          <Button
            onClick={submit}
            disabled={assign.isPending || !(Number(value) > 0) || Number(value) === contract?.bidder_no}
            className="gap-1.5"
          >
            {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Đổi số
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

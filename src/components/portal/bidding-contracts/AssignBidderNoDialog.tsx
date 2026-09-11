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
  /** Số tiếp theo trong phiên (max + 1) — server tự cấp cũng theo cùng quy tắc. */
  suggested: number;
  onOpenChange: (open: boolean) => void;
}

export function AssignBidderNoDialog({ contract, suggested, onOpenChange }: Props) {
  const assign = useAssignBidderNo();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (contract) setValue(String(contract.bidder_no ?? suggested));
  }, [contract, suggested]);

  const submit = (bidderNo?: number) => {
    if (!contract) return;
    assign.mutate({ contractId: contract.id, bidderNo }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={!!contract} onOpenChange={(v) => !assign.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{contract?.bidder_no ? "Đổi số báo danh" : "Cấp số báo danh"}</DialogTitle>
          <DialogDescription>
            {contract?.code} · {contract?.full_name}. Số báo danh không trùng trong cùng phiên.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-1">
          <Label>Số báo danh</Label>
          <NumberInput value={value} onChange={setValue} allowDecimal={false} />
          {!contract?.bidder_no && <p className="text-xs text-muted-foreground">Gợi ý số tiếp theo: {suggested}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!contract?.bidder_no && (
            <Button variant="outline" onClick={() => submit(undefined)} disabled={assign.isPending}>
              Tự cấp số tiếp theo
            </Button>
          )}
          <Button onClick={() => submit(Number(value))} disabled={assign.isPending || !(Number(value) > 0)} className="gap-1.5">
            {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Cấp số này
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

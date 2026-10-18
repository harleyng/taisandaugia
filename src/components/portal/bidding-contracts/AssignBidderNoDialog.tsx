import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAssignBidderNo } from "@/hooks/useOrgBiddingContracts";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import type { ContractWithSession } from "@/types/bidding-contract";

interface Props {
  contract: ContractWithSession | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * ĐỔI số báo danh của người đã điểm danh (org_assign_bidder_no đòi checked_in_at).
 * Số đầu tiên chỉ sinh ra lúc điểm danh — không còn "cấp số" từ màn này.
 * Bố cục theo design "Gán số báo danh mới" (Hiện tại → Số mới); design còn có ô lý do
 * + khoá số cũ nhưng DB chưa lưu lịch sử số ⇒ chưa làm.
 */
export function AssignBidderNoDialog({ contract, onOpenChange }: Props) {
  const assign = useAssignBidderNo();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (contract) setValue(formatBidderNo(contract.bidder_no) ?? "");
  }, [contract]);

  const n = Number(value);
  const error =
    !value || !Number.isInteger(n) || n < 1 || n > 999
      ? "Nhập số từ 001 đến 999."
      : n === contract?.bidder_no
        ? "Số mới phải khác số hiện tại."
        : null;

  const submit = () => {
    if (!contract || error) return;
    assign.mutate({ contractId: contract.id, bidderNo: n }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={!!contract} onOpenChange={(v) => !assign.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Gán số báo danh mới</DialogTitle>
          <DialogDescription>
            {contract?.org_name ?? contract?.full_name} · <span className="font-mono">{contract?.code}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-3.5">
          <div className="flex flex-col gap-1.5">
            <small className="text-[12.5px] font-medium text-muted-foreground">Hiện tại</small>
            <span className="inline-flex h-[38px] min-w-[44px] items-center justify-center rounded-md bg-primary/10 px-[7px] font-mono text-[15px] font-bold text-primary">
              {formatBidderNo(contract?.bidder_no) ?? "—"}
            </span>
          </div>
          <ChevronRight className="mb-2.5 h-[18px] w-[18px] text-muted-foreground/70" aria-hidden />
          <label className="flex flex-col gap-1.5">
            <small className="text-[12.5px] font-medium text-muted-foreground">Số mới</small>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 3))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              inputMode="numeric"
              maxLength={3}
              className="w-24 text-center font-mono text-[15px] font-bold"
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
        </div>

        {value && error && <p className="text-[12.5px] font-medium text-destructive">{error}</p>}
        <p className="text-[12.5px] text-muted-foreground">Số báo danh không được trùng với người khác trong cùng phiên.</p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={assign.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={assign.isPending || !!error} className="gap-1.5">
            {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Gán số mới
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

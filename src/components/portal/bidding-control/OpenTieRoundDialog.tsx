import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { DEFAULT_DURATION_MINUTES, durationChoiceValid, durationSecondsOf } from "@/lib/bidding/controlAccess";
import { roundLabel } from "@/lib/bidding/sealed";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";
import { DurationPicker } from "./DurationPicker";

/**
 * Mở vòng phụ bỏ phiếu kín cho những người bằng giá (org_open_tie_round). Thời gian
 * nhận phiếu BẮT BUỘC và không bị cắt theo giờ kết thúc phiên.
 */

interface Props {
  lot: AuctionSessionItem | null;
  state: LotState | null;
  now: Date;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (durationSeconds: number) => void;
}

export function OpenTieRoundDialog({ lot, state, now, pending, onOpenChange, onConfirm }: Props) {
  const [choice, setChoice] = useState(String(DEFAULT_DURATION_MINUTES));
  const [custom, setCustom] = useState("");

  const seconds = durationSecondsOf(choice, custom);
  const valid = durationChoiceValid(choice, custom) && seconds != null;
  const nextRound = (state?.round_no ?? 1) + 1;
  const nos = state?.tied_bidder_nos ?? [];

  const close = (open: boolean) => {
    if (!open) {
      setChoice(String(DEFAULT_DURATION_MINUTES));
      setCustom("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={!!lot} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Mở {roundLabel(nextRound).toLowerCase()} — tài sản {lot?.lot_no}
          </DialogTitle>
          <DialogDescription>
            Chỉ số báo danh {nos.map(formatBidderNo).join(", ")} được nộp phiếu. Mỗi người một phiếu, giá từ{" "}
            {formatVnd(state?.tie_amount ?? null)} trở lên.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Thời gian nhận phiếu</Label>
          <DurationPicker
            idPrefix="tie"
            choice={choice}
            custom={custom}
            onChoice={setChoice}
            onCustom={setCustom}
            allowUntilEnd={false}
          />
        </div>

        {seconds != null && (
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            Vòng phụ đóng lúc{" "}
            <strong className="text-foreground">{formatDateTime(new Date(now.getTime() + seconds * 1000).toISOString())}</strong>.
            Không ai nộp phiếu thì người nộp sớm nhất trong nhóm bằng giá trúng.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={pending}>
            Huỷ
          </Button>
          <Button onClick={() => seconds != null && onConfirm(seconds)} disabled={!valid || pending} className="gap-1.5">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Mở vòng phụ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

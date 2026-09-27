import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuoteDetails } from "@/components/consignment/QuoteDetails";
import type { RequestWithOrg } from "@/hooks/useAssetPosting";

interface QuoteDetailsDialogProps {
  quote: RequestWithOrg | null;
  startingPrice: number | null;
  onOpenChange: (open: boolean) => void;
}

/** Phương án tổ chức phiên + khoản mục chi phí + ghi chú của MỘT báo giá. */
export function QuoteDetailsDialog({ quote, startingPrice, onOpenChange }: QuoteDetailsDialogProps) {
  return (
    <Dialog open={!!quote} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Phương án & chi phí chi tiết</DialogTitle>
          <DialogDescription>{quote?.org?.name ?? "Tổ chức đấu giá"}</DialogDescription>
        </DialogHeader>
        {quote && (
          <div className="space-y-3">
            <QuoteDetails
              plan={quote.quote_plan}
              feeItems={quote.quote_fee_items}
              startingPrice={quote.quote_starting_price ?? startingPrice}
              className="rounded-lg border border-border bg-muted/20 p-3"
            />
            {quote.quote_note && (
              <div className="rounded-lg bg-muted/40 px-3.5 py-3 text-[13.5px] text-foreground">
                <span className="mb-0.5 block text-[11.5px] text-muted-foreground">Ghi chú của tổ chức</span>
                {quote.quote_note}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

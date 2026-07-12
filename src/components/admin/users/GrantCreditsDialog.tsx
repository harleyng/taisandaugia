import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import { useGrantCredits } from "@/hooks/useAdminUsers";
import type { AdminUser } from "@/types/adminUser";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
}

export function GrantCreditsDialog({ open, onOpenChange, user }: Props) {
  const grant = useGrantCredits();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
    }
  }, [open]);

  const numAmount = parseNumber(amount);

  const submit = async () => {
    if (numAmount <= 0) return toast.error("Vui lòng nhập số credit hợp lệ");
    try {
      await grant.mutateAsync({ userId: user.id, amount: numAmount, note: note.trim() || undefined });
      toast.success(`Đã tặng ${groupNumber(numAmount)} CR cho ${user.name || user.email}`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Tặng credit thất bại", { description: (err as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tặng credit</DialogTitle>
          <DialogDescription>
            Số dư hiện tại: <span className="font-medium text-foreground">{groupNumber(user.balance)} CR</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Số credit tặng <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                inputMode="numeric"
                value={amount ? groupNumber(numAmount) : ""}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">CR</span>
            </div>
            {numAmount > 0 && (
              <p className="text-xs text-muted-foreground">
                Số dư sau khi tặng: {groupNumber(user.balance + numAmount)} CR
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Lý do tặng credit (tuỳ chọn)" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={submit} disabled={grant.isPending || numAmount <= 0}>
            {grant.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Tặng {numAmount > 0 ? `${groupNumber(numAmount)} CR` : "credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMoveOpportunityStage, opportunityErrorMessage } from "@/hooks/useOpportunities";
import { STAGE_LABELS } from "@/lib/opportunities/opportunityStage";
import type { Opportunity } from "@/types/opportunities";

interface Props {
  opportunity: Opportunity | null;
  stage: "lost" | "rejected";
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

const PRESETS = [
  "Giá cao hơn đối thủ",
  "Khách hoãn ngân sách",
  "Không đủ hồ sơ pháp lý",
  "Chọn nhà cung cấp khác",
];

/** Bắt buộc hỏi lý do: DB có CHECK stage NOT IN ('lost','rejected') OR
 *  lost_reason IS NOT NULL — không hỏi thì request chắc chắn lỗi. */
export function LostOpportunityDialog({ opportunity: o, stage, onOpenChange, onDone }: Props) {
  const move = useMoveOpportunityStage();
  const [reason, setReason] = useState("");

  useEffect(() => { if (o) setReason(""); }, [o]);

  const submit = async () => {
    if (!o) return;
    if (!reason.trim()) return toast.error("Vui lòng nhập lý do");
    try {
      await move.mutateAsync({ id: o.id, stage, lostReason: reason.trim() });
      toast.success(`Đã chuyển sang "${STAGE_LABELS[stage]}"`);
      onOpenChange(false);
      onDone?.();
    } catch (err) {
      toast.error(opportunityErrorMessage(err) ?? "Thao tác thất bại");
    }
  };

  return (
    <Dialog open={!!o} onOpenChange={(v) => { if (!v) { onOpenChange(false); onDone?.(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chuyển sang &quot;{STAGE_LABELS[stage]}&quot;</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">{o?.name}</p>
          <div className="space-y-1.5">
            <Label>Lý do <span className="text-destructive">*</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReason(p)}
                  className="text-[11px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted"
                >
                  {p}
                </button>
              ))}
            </div>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập lý do…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onDone?.(); }}>Hủy</Button>
          <Button onClick={submit} disabled={move.isPending}>Xác nhận</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

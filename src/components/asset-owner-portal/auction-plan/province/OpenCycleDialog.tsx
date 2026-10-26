import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CycleUnitsEditor } from "./CycleUnitsEditor";
import { buildCycleDraft, type CycleUnitDraftMap } from "./cycleDraft";
import {
  usePlanCycleCandidates,
  useOpenPlanCycle,
  type CycleUnitInput,
} from "@/hooks/useAuctionPlanProvince";
import { AUCTION_PLAN_KIND_LABELS, type AuctionPlanCycleKind } from "@/lib/auctionPlan/types";

interface OpenCycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Năm đang xem ở trang "Toàn tỉnh" — mặc định của ô Năm. */
  defaultYear: number;
  onOpened?: (cycleId: string) => void;
}

const YEAR_SPAN = 4;

/**
 * "Mở đợt lập kế hoạch" (§A4.1) — tỉnh ra hạn trình, hướng dẫn và chỉ tiêu cho
 * từng xã. Mở đợt KHÔNG tạo gì trong các xã: trang danh sách của xã đọc đợt rồi
 * hiện bảng thông báo + nút "Lập kế hoạch" đã gắn `cycle_id`.
 *
 * Một (Trạm, năm, loại) chỉ có MỘT đợt — trùng mà đợt cũ đang mở thì RPC trả
 * `already_open`, hộp thoại hiện đúng câu đó.
 */
export function OpenCycleDialog({
  open,
  onOpenChange,
  workspaceId,
  defaultYear,
  onOpened,
}: OpenCycleDialogProps) {
  const candidatesQuery = usePlanCycleCandidates(workspaceId, open);
  const candidates = useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data]);
  const openCycle = useOpenPlanCycle(workspaceId);

  const [planYear, setPlanYear] = useState(defaultYear);
  const [kind, setKind] = useState<AuctionPlanCycleKind>("annual");
  const [deadline, setDeadline] = useState("");
  const [instructions, setInstructions] = useState("");
  const [draft, setDraft] = useState<CycleUnitDraftMap>({});

  // Mỗi lần mở lại: về mặc định và chọn SẴN mọi xã (tỉnh thường giao cả tỉnh).
  useEffect(() => {
    if (!open) return;
    setPlanYear(defaultYear);
    setKind("annual");
    setDeadline("");
    setInstructions("");
  }, [open, defaultYear]);

  useEffect(() => {
    if (!open) return;
    setDraft(() => {
      const base = buildCycleDraft(candidates);
      for (const code of Object.keys(base)) base[code].selected = true;
      return base;
    });
  }, [open, candidates]);

  const years = useMemo(
    () => Array.from({ length: YEAR_SPAN }, (_, i) => defaultYear - 1 + i),
    [defaultYear],
  );
  const selectedCount = candidates.filter((c) => draft[c.admin_unit_code]?.selected).length;

  const submit = () => {
    const units: CycleUnitInput[] = candidates
      .filter((c) => draft[c.admin_unit_code]?.selected)
      .map((c) => ({
        admin_unit_code: c.admin_unit_code,
        branch_id: c.shape === "branch" ? c.branch_id : null,
        child_workspace_id: c.shape === "child" ? c.child_workspace_id : null,
        assigned_revenue: draft[c.admin_unit_code]?.revenue ?? null,
        assigned_count: draft[c.admin_unit_code]?.count ?? null,
      }));
    openCycle.mutate(
      { planYear, kind, submitDeadline: deadline || null, instructions: instructions.trim() || null, units },
      {
        onSuccess: (cycleId) => {
          onOpenChange(false);
          onOpened?.(cycleId);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
            Mở đợt lập kế hoạch
          </DialogTitle>
          <DialogDescription>
            Đợt là lần tỉnh yêu cầu các xã, phường lập và trình kế hoạch đấu giá. Mở đợt không tạo kế hoạch
            thay đơn vị — đơn vị sẽ thấy bảng thông báo kèm hạn trình.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cycle-year">
                Năm kế hoạch <span className="text-destructive">*</span>
              </Label>
              <Select value={String(planYear)} onValueChange={(v) => v && setPlanYear(Number(v))}>
                <SelectTrigger id="cycle-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cycle-kind">
                Loại kế hoạch <span className="text-destructive">*</span>
              </Label>
              <Select value={kind} onValueChange={(v) => v && setKind(v as AuctionPlanCycleKind)}>
                <SelectTrigger id="cycle-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["annual", "supplement"] as AuctionPlanCycleKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {AUCTION_PLAN_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cycle-deadline">Hạn trình</Label>
              <Input
                id="cycle-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cycle-instructions">Hướng dẫn gửi các đơn vị</Label>
            <Textarea
              id="cycle-instructions"
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Căn cứ, biểu mẫu, cách gửi hồ sơ kèm theo…"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Đơn vị trong đợt <span className="text-destructive">*</span>
            </p>
            <CycleUnitsEditor
              candidates={candidates}
              draft={draft}
              onChange={setDraft}
              disabled={openCycle.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={openCycle.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={openCycle.isPending || selectedCount === 0}>
            {openCycle.isPending ? "Đang mở đợt…" : `Mở đợt cho ${selectedCount} đơn vị`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

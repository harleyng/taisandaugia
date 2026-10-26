import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleX, Loader2 } from "lucide-react";
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
import { useCreateAuctionPlan, type PlanUnitOption } from "@/hooks/useAuctionPlans";
import { ownerPlanHref } from "@/lib/auctionPlan/routes";
import { findAnnualPlanConflict } from "@/lib/auctionPlan/totals";
import {
  AUCTION_PLAN_KIND_LABELS,
  auctionPlanAutoTitle,
  type AuctionPlan,
  type AuctionPlanKind,
} from "@/lib/auctionPlan/types";
import type { PlanCycleContext } from "@/lib/auctionPlan/cycles";

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  plans: readonly AuctionPlan[];
  unitOptions: readonly PlanUnitOption[];
  cycle: PlanCycleContext | null;
  /** Năm đang chọn ở trang danh sách — mặc định của hộp thoại. */
  planYear: number;
}

const KINDS: AuctionPlanKind[] = ["annual", "supplement"];
const Star = () => <span className="text-destructive">*</span>;

/**
 * "Tạo kế hoạch": năm · loại · đơn vị lập kế hoạch · tên (tự đặt khi để trống).
 *
 * Trùng kế hoạch NĂM của cùng đơn vị + năm (bản còn hiệu lực) ⇒ cảnh báo + khoá
 * nút Lưu, cùng UX với trang Chỉ tiêu. Đây là bản sao ở client của partial
 * unique index; index mới là cổng thật khi hai người bấm Lưu cùng lúc.
 */
export function CreatePlanDialog({
  open,
  onOpenChange,
  workspaceId,
  plans,
  unitOptions,
  cycle,
  planYear,
}: CreatePlanDialogProps) {
  const navigate = useNavigate();
  const createM = useCreateAuctionPlan(workspaceId);
  const [year, setYear] = useState(planYear);
  const [kind, setKind] = useState<AuctionPlanKind>("annual");
  const [unitKey, setUnitKey] = useState<string>(unitOptions[0] ? String(unitOptions[0].branchId) : "null");
  const [title, setTitle] = useState("");
  const [legalBasis, setLegalBasis] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setYear(planYear);
      setKind("annual");
      setUnitKey(unitOptions[0] ? String(unitOptions[0].branchId) : "null");
      setTitle("");
      setLegalBasis("");
      setNotes("");
    }
  }, [open, planYear, unitOptions]);

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => [currentYear - 1, currentYear, currentYear + 1, currentYear + 2],
    [currentYear],
  );
  const unit = unitOptions.find((u) => String(u.branchId) === unitKey) ?? null;
  const conflict =
    kind === "annual" && unit ? findAnnualPlanConflict(plans, { branchId: unit.branchId, planYear: year }) : null;
  const untagged = !!unit && !unit.adminUnitCode;
  const autoTitle = auctionPlanAutoTitle(year, unit?.label);
  const blocked = !unit || !!conflict || untagged;

  const save = () => {
    if (!unit || blocked) return;
    createM.mutate(
      {
        branchId: unit.branchId,
        planYear: year,
        kind,
        level: unit.level,
        title: title.trim() || null,
        legalBasis: legalBasis.trim() || null,
        notes: notes.trim() || null,
        cycleId: cycle && cycle.cycle.plan_year === year && cycle.cycle.kind === kind ? cycle.cycle.id : null,
      },
      {
        onSuccess: (plan) => {
          onOpenChange(false);
          navigate(ownerPlanHref(plan.id));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !createM.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Tạo kế hoạch đấu giá</DialogTitle>
          <DialogDescription>Mỗi đơn vị có một kế hoạch năm còn hiệu lực; cần thêm thì lập kế hoạch bổ sung.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-year">
                Năm kế hoạch <Star />
              </Label>
              <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
                <SelectTrigger id="plan-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-kind">
                Loại kế hoạch <Star />
              </Label>
              <Select value={kind} onValueChange={(v) => v && setKind(v as AuctionPlanKind)}>
                <SelectTrigger id="plan-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {AUCTION_PLAN_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-unit">
              Đơn vị lập kế hoạch <Star />
            </Label>
            <Select value={unitKey} onValueChange={(v) => v && setUnitKey(v)}>
              <SelectTrigger id="plan-unit">
                <SelectValue placeholder="Chọn đơn vị" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((u) => (
                  <SelectItem key={String(u.branchId)} value={String(u.branchId)}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-title">Tên kế hoạch</Label>
            <Input
              id="plan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={autoTitle}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">Để trống thì hệ thống đặt là «{autoTitle}».</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-legal">Căn cứ pháp lý</Label>
            <Textarea
              id="plan-legal"
              value={legalBasis}
              onChange={(e) => setLegalBasis(e.target.value)}
              rows={2}
              placeholder="Luật Đất đai 2024, Luật Đấu giá tài sản, nghị quyết của HĐND…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-notes">Ghi chú</Label>
            <Textarea id="plan-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {conflict && (
            <div role="alert" className="flex items-start gap-2.5 rounded-[10px] bg-warning/15 px-3 py-2.5 text-[13px]">
              <CircleX className="mt-px h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <p>
                Đơn vị này đã có kế hoạch năm {year} chưa đóng.{" "}
                <button
                  type="button"
                  className="font-[650] underline underline-offset-2"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(ownerPlanHref(conflict.id));
                  }}
                >
                  Mở kế hoạch đó
                </button>{" "}
                hoặc chọn «{AUCTION_PLAN_KIND_LABELS.supplement}».
              </p>
            </div>
          )}

          {untagged && (
            <div role="alert" className="flex items-start gap-2.5 rounded-[10px] bg-warning/15 px-3 py-2.5 text-[13px]">
              <CircleX className="mt-px h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <p>
                «{unit?.label}» chưa được gắn đơn vị hành chính (xã / phường / đặc khu).{" "}
                <button
                  type="button"
                  className="font-[650] underline underline-offset-2"
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/chu-tai-san/chi-nhanh-amc");
                  }}
                >
                  Gắn ở trang Chi nhánh / AMC
                </button>{" "}
                rồi tạo lại.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={createM.isPending} onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button disabled={blocked || createM.isPending} onClick={save}>
            {createM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tạo kế hoạch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

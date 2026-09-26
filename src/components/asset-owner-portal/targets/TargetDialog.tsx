import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WideRadio } from "@/components/asset-posting/fields";
import { OptionalMark, OutcomeFieldError } from "@/components/asset-owner-portal/outcomes/OutcomeFieldError";
import { useDeleteOwnerTarget, useSaveOwnerTarget } from "@/hooks/useOwnerTargets";
import type { WorkspaceBranchOption } from "@/hooks/useOwnerWorkspaceMembers";
import { todayIso } from "@/lib/ownerOutcomeReport";
import {
  SCOPE_ALL,
  TARGET_PERIOD_LABEL,
  TARGET_PERIOD_TYPES,
  findTarget,
  periodOptions,
  targetFormDefaults,
  targetFormSchema,
  type OwnerTarget,
  type TargetForm,
  type TargetPeriodType,
} from "@/lib/ownerTargets";
import { formatMoneyShort } from "@/utils/money";

export interface TargetDialogInitial {
  periodType: TargetPeriodType;
  periodStart: string;
  /** SCOPE_ALL hoặc workspace_branches.id. */
  scope: string;
}

interface TargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Mọi chỉ tiêu đã có — chọn trúng kỳ + phạm vi đã có thì form chuyển sang sửa. */
  targets: OwnerTarget[];
  branches: WorkspaceBranchOption[];
  initial: TargetDialogInitial;
}

/** "Đặt chỉ tiêu" — số tiền thu hồi và/hoặc số tài sản đấu thành cho một kỳ, cả đơn vị hoặc một chi nhánh. */
export function TargetDialog({ open, onOpenChange, workspaceId, targets, branches, initial }: TargetDialogProps) {
  const save = useSaveOwnerTarget(workspaceId);
  const remove = useDeleteOwnerTarget(workspaceId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = save.isPending || remove.isPending;

  const today = useMemo(() => todayIso(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const form = useForm<TargetForm>({ resolver: zodResolver(targetFormSchema) });
  const errors = form.formState.errors;
  const [periodType, periodStart, scope, amount] = useWatch({
    control: form.control,
    name: ["periodType", "periodStart", "scope", "amount"],
  });

  const options = useMemo(() => (periodType ? periodOptions(periodType, today) : []), [periodType, today]);
  const existing = periodType ? findTarget(targets, periodType, periodStart, scope) : null;

  // Mở dialog ⇒ dựng form từ kỳ + phạm vi khối đang hiển thị.
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    form.reset(targetFormDefaults(findTarget(targets, initial.periodType, initial.periodStart, initial.scope), initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Đổi kỳ / phạm vi ⇒ nạp số của chỉ tiêu đã có (hoặc để trống cho chỉ tiêu mới).
  useEffect(() => {
    if (!open || !periodType) return;
    setConfirmDelete(false);
    form.setValue("amount", existing?.targetAmount ? String(Math.round(existing.targetAmount)) : "");
    form.setValue("count", existing?.targetCount ? String(existing.targetCount) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const pickType = (type: TargetPeriodType) => {
    form.setValue("periodType", type);
    form.setValue("periodStart", periodOptions(type, today)[0].start);
  };

  const close = () => !busy && onOpenChange(false);
  const submit = form.handleSubmit((values) =>
    save.mutate({ id: existing?.id ?? null, form: values }, { onSuccess: () => onOpenChange(false) }),
  );
  const onDelete = () => {
    if (!existing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    remove.mutate(existing.id, { onSuccess: () => onOpenChange(false) });
  };

  const amountNumber = Number(amount || 0);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Sửa chỉ tiêu" : "Đặt chỉ tiêu"}</DialogTitle>
          <DialogDescription>Số đã thu được tính theo ngày phiên nằm trong kỳ.</DialogDescription>
        </DialogHeader>

        <form id="owner-target-form" className="space-y-5" onSubmit={submit} noValidate>
          <div className="space-y-2">
            <Label>Kỳ</Label>
            <div className="grid grid-cols-3 gap-2">
              {TARGET_PERIOD_TYPES.map((type) => (
                <WideRadio key={type} on={periodType === type} onClick={() => !busy && pickType(type)} className="h-full">
                  <span className="text-sm font-medium">{TARGET_PERIOD_LABEL[type]}</span>
                </WideRadio>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="target-period">Kỳ cụ thể</Label>
              <Controller
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  // Radix Select gọi onValueChange("") khi danh sách kỳ đổi (Tháng → Quý) ⇒ bỏ qua giá trị rỗng.
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)} disabled={busy}>
                    <SelectTrigger id="target-period">
                      <SelectValue placeholder="Chọn kỳ" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.start} value={o.start}>
                          {o.label.charAt(0).toUpperCase() + o.label.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <OutcomeFieldError msg={errors.periodStart?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-scope">Phạm vi</Label>
              <Controller
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)} disabled={busy}>
                    <SelectTrigger id="target-scope">
                      <SelectValue placeholder="Chọn phạm vi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SCOPE_ALL}>Toàn đơn vị</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.isActive ? b.label : `${b.label} · ngừng hoạt động`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <OutcomeFieldError msg={errors.scope?.message} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="target-amount">
                Số tiền thu hồi (₫)
                <OptionalMark />
              </Label>
              <Controller
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <NumberInput
                    id="target-amount"
                    allowDecimal={false}
                    className="tabular-nums"
                    disabled={busy}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.amount ? (
                <OutcomeFieldError msg={errors.amount.message} />
              ) : (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {amountNumber > 0 ? `= ${formatMoneyShort(amountNumber)}` : "Tiền thu về từ các phiên trong kỳ"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-count">
                Số tài sản đấu thành
                <OptionalMark />
              </Label>
              <Controller
                control={form.control}
                name="count"
                render={({ field }) => (
                  <NumberInput
                    id="target-count"
                    allowDecimal={false}
                    className="tabular-nums"
                    disabled={busy}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.count ? (
                <OutcomeFieldError msg={errors.count.message} />
              ) : (
                <p className="text-xs text-muted-foreground">Không tính tài sản người trúng bỏ cọc</p>
              )}
            </div>
          </div>
        </form>

        <DialogFooter className="gap-2 sm:justify-between sm:gap-0">
          {existing ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={busy}
              onClick={onDelete}
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmDelete ? "Bấm lần nữa để xoá" : "Xoá chỉ tiêu"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              Đóng
            </Button>
            <Button type="submit" form="owner-target-form" disabled={busy}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu chỉ tiêu
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

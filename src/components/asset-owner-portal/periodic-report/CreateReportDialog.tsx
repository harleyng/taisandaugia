import { useEffect, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WideRadio } from "@/components/asset-posting/fields";
import { OutcomeFieldError } from "@/components/asset-owner-portal/outcomes/OutcomeFieldError";
import { useCreateReportDraft } from "@/hooks/useOwnerPeriodicReports";
import type { WorkspaceBranchOption } from "@/hooks/useOwnerWorkspaceMembers";
import { todayIso } from "@/lib/ownerOutcomeReport";
import { TARGET_PERIOD_LABEL, TARGET_PERIOD_TYPES, type TargetPeriodType } from "@/lib/ownerTargets";
import {
  SCOPE_ALL,
  createReportSchema,
  previousPeriodStart,
  reportPeriodOptions,
  type CreateReportForm,
  type OwnerReportListItem,
} from "@/lib/ownerPeriodicReport";

interface CreateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  branches: WorkspaceBranchOption[];
  /** null = được lập cho cả đơn vị lẫn mọi chi nhánh; mảng = Cán bộ chỉ lập cho các chi nhánh này. */
  allowedBranchIds: readonly string[] | null;
  /** Báo cáo đã có — để nhắc khi chọn trúng kỳ + phạm vi đã lập. */
  existing: OwnerReportListItem[];
  onCreated: (reportId: string) => void;
}

/** "Tạo báo cáo": chọn kỳ + phạm vi ⇒ tạo bản nháp rồi mở trang xem trước. */
export function CreateReportDialog({
  open,
  onOpenChange,
  workspaceId,
  branches,
  allowedBranchIds,
  existing,
  onCreated,
}: CreateReportDialogProps) {
  const create = useCreateReportDraft(workspaceId);
  const today = useMemo(() => todayIso(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const scopeOptions = useMemo(
    () => (allowedBranchIds ? branches.filter((b) => allowedBranchIds.includes(b.id)) : branches),
    [branches, allowedBranchIds],
  );

  const form = useForm<CreateReportForm>({ resolver: zodResolver(createReportSchema) });
  const errors = form.formState.errors;
  const [periodType, periodStart, scope] = useWatch({
    control: form.control,
    name: ["periodType", "periodStart", "scope"],
  });
  const options = useMemo(() => (periodType ? reportPeriodOptions(periodType, today) : []), [periodType, today]);

  // Mặc định: tháng vừa kết thúc; phạm vi cả đơn vị (Cán bộ bị giới hạn: chi nhánh đầu tiên của mình).
  useEffect(() => {
    if (!open) return;
    form.reset({
      periodType: "month",
      periodStart: previousPeriodStart("month", today),
      scope: allowedBranchIds ? scopeOptions[0]?.id ?? "" : SCOPE_ALL,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickType = (type: TargetPeriodType) => {
    form.setValue("periodType", type);
    form.setValue("periodStart", previousPeriodStart(type, today));
  };

  const branchId = scope === SCOPE_ALL ? null : scope;
  const same = existing.filter(
    (r) => r.periodType === periodType && r.periodStart === periodStart && r.branchId === branchId,
  );
  const sameFinal = same.some((r) => r.status === "final");
  const sameDraft = same.some((r) => r.status === "draft");

  const busy = create.isPending;
  const close = () => !busy && onOpenChange(false);
  const submit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (id) => {
        onOpenChange(false);
        onCreated(id);
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Tạo báo cáo định kỳ</DialogTitle>
          <DialogDescription>
            Hệ thống tự tổng hợp số liệu của kỳ. Bạn xem trước, thêm ghi chú rồi Trưởng đơn vị chốt để gửi trụ sở.
          </DialogDescription>
        </DialogHeader>

        <form id="owner-report-create" className="space-y-5" onSubmit={submit} noValidate>
          <div className="space-y-2">
            <Label>Loại kỳ</Label>
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
              <Label htmlFor="report-period">Kỳ báo cáo</Label>
              <Controller
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  // Radix Select gọi onValueChange("") khi danh sách kỳ đổi (Tháng → Quý) ⇒ bỏ qua giá trị rỗng.
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)} disabled={busy}>
                    <SelectTrigger id="report-period">
                      <SelectValue placeholder="Chọn kỳ" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.start} value={o.start}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <OutcomeFieldError msg={errors.periodStart?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-scope">Phạm vi</Label>
              <Controller
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)} disabled={busy}>
                    <SelectTrigger id="report-scope">
                      <SelectValue placeholder="Chọn phạm vi" />
                    </SelectTrigger>
                    <SelectContent>
                      {!allowedBranchIds && <SelectItem value={SCOPE_ALL}>Toàn đơn vị</SelectItem>}
                      {scopeOptions.map((b) => (
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

          {(sameFinal || sameDraft) && (
            <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {sameFinal
                ? "Kỳ và phạm vi này đã có báo cáo đã chốt. Báo cáo mới sẽ là bản đính chính — bản cũ vẫn được giữ nguyên."
                : "Kỳ và phạm vi này đang có bản nháp. Bạn có thể mở bản nháp đó thay vì tạo thêm."}
            </p>
          )}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={close}>
            Đóng
          </Button>
          <Button type="submit" form="owner-report-create" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tạo bản nháp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

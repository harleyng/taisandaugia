import { useEffect, useMemo, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { WideRadio } from "@/components/asset-posting/fields";
import { useOwnerOutcomeRounds, useReportOwnerOutcome } from "@/hooks/useOwnerOutcomeReports";
import { useOwnerOutcomeHistory } from "@/hooks/useOwnerOutcomesOverview";
import { useSaveOwnerOutcome } from "@/hooks/useOwnerOutcomeEdit";
import {
  REPORT_KINDS,
  REPORT_KIND_META,
  buildOutcomeDefaults,
  isOffPlatformTarget,
  makeReportOutcomeSchema,
  outcomeTargetKey,
  todayIso,
  type OutcomeDialogTarget,
  type ReportKind,
  type ReportOutcomeForm,
} from "@/lib/ownerOutcomeReport";
import { recordToFormDefaults, type OwnerOutcomeRecord } from "@/lib/ownerOutcomeEdit";
import { formatMoneyFull } from "@/utils/money";
import { OutcomeFieldError } from "./OutcomeFieldError";
import { OutcomeNotSoldFields } from "./OutcomeNotSoldFields";
import { OutcomeSoldFields } from "./OutcomeSoldFields";
import { OffPlatformAssetFields, type BranchOption } from "./OffPlatformAssetFields";

export interface ReportOutcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Tin trên sàn, hoặc tài sản ngoài sàn (`{ kind: "offplatform" }`, Phase 8). */
  target: OutcomeDialogTarget | null;
  /** Chọn sẵn kết quả (thẻ việc cần làm ở "Nhịp đập" mở dialog với lựa chọn đã bấm). */
  defaultKind?: ReportKind;
  /** Sửa một lượt đã khai thay vì khai lượt mới (Phase 8). */
  record?: OwnerOutcomeRecord | null;
  /** Chỉ dùng cho tài sản ngoài sàn: chi nhánh chọn được + phạm vi của người dùng (null = toàn đơn vị). */
  branches?: BranchOption[];
  branchScope?: string[] | null;
}

const NO_BRANCHES: BranchOption[] = [];

/** "Khai kết quả" — đơn vị tự khai (hoặc sửa) kết quả một lượt đấu giá của tài sản, ~30 giây. */
export function ReportOutcomeDialog({
  open,
  onOpenChange,
  workspaceId,
  target,
  defaultKind = "sold",
  record = null,
  branches = NO_BRANCHES,
  branchScope = null,
}: ReportOutcomeDialogProps) {
  const isEdit = !!record;
  const offTarget = isOffPlatformTarget(target) ? target : null;
  const offMode = isEdit ? !record.listing_id : !!offTarget;
  const listingId = target && !isOffPlatformTarget(target) ? target.listingId : null;

  // Lượt đã khai — để điền sẵn "lượt tiếp theo". Sửa: lượt lấy từ bản ghi.
  const rounds = useOwnerOutcomeRounds(workspaceId, open && !isEdit ? listingId : null);
  const offKey = open && !isEdit && offTarget?.titleKey ? offTarget.titleKey : null;
  const offHistory = useOwnerOutcomeHistory(workspaceId, offKey ? { listingId: null, titleKey: offKey } : null);
  const report = useReportOwnerOutcome(workspaceId);
  const save = useSaveOwnerOutcome(workspaceId);
  const [evidence, setEvidence] = useState<File | null>(null);

  // "Hôm nay" chốt lúc mở dialog: chặn ngày tương lai cả ở schema lẫn ô chọn ngày.
  const today = useMemo(() => todayIso(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const schema = useMemo(
    () => makeReportOutcomeSchema(today, { offPlatform: offMode, branchRequired: offMode && !!branchScope }),
    [today, offMode, branchScope],
  );
  const form = useForm<ReportOutcomeForm>({ resolver: zodResolver(schema) });

  // Chờ danh sách lượt TƯƠI (kể cả refetch sau lần khai trước) rồi mới dựng form,
  // nếu không "lượt tiếp theo" lấy từ cache cũ sẽ đụng unique index. Query nào
  // không cần (sửa, tài sản ngoài sàn mới) thì không chờ — query tắt không bao giờ "success".
  const q = offMode ? offHistory : rounds;
  const needRounds = !isEdit && (offMode ? !!offKey : !!listingId);
  const roundsReady = !needRounds || (q.fetchStatus === "idle" && (q.isSuccess || q.isError));
  const reported = offMode ? (offHistory.data ?? []).map((r) => r.round_no) : rounds.data ?? [];
  const ready = open && !!target && roundsReady;
  const key = target ? (record ? `e:${record.id}` : outcomeTargetKey(target)) : null;
  // Form chỉ hiện SAU khi reset xong cho đúng tài sản này — không có khung hình rỗng.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLoadedFor(null);
      return;
    }
    if (!ready || !target) return;
    form.reset(record ? recordToFormDefaults(record) : buildOutcomeDefaults(target, reported, defaultKind, today));
    setEvidence(null);
    setLoadedFor(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, key, defaultKind]);
  const showForm = ready && key !== null && loadedFor === key;

  const kind = form.watch("kind");
  const busy = report.isPending || save.isPending;
  const errors = form.formState.errors;

  const submit = form.handleSubmit((values) => {
    if (!target) return;
    const file = values.kind === "sold" ? evidence : null;
    const done = { onSuccess: () => onOpenChange(false) };
    if (record) save.mutate({ mode: "update", form: values, record, evidence: file }, done);
    else if (offTarget) save.mutate({ mode: "create", form: values, target: offTarget, evidence: file }, done);
    else if (!isOffPlatformTarget(target)) report.mutate({ form: values, target, evidence: file }, done);
  });

  const title = isEdit
    ? `Sửa lượt ${record.round_no}`
    : offTarget
      ? offTarget.titleKey
        ? "Khai lượt tiếp theo"
        : "Khai tài sản ngoài sàn"
      : "Khai kết quả phiên";
  const assetName = offTarget?.title || (target && !isOffPlatformTarget(target) ? target.title : null);
  const startingPrice = target && !offMode ? target.startingPrice : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="space-y-0.5">
            {assetName ? (
              <span className="line-clamp-2 block text-foreground">{assetName}</span>
            ) : (
              <span className="block">Tài sản đấu giá không qua taisandaugia — chỉ đơn vị của bạn thấy kết quả này.</span>
            )}
            {startingPrice ? (
              <span className="block tabular-nums">Giá khởi điểm {formatMoneyFull(startingPrice)}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {!showForm ? (
          <div className="space-y-3" aria-busy="true">
            <div className="grid gap-2 sm:grid-cols-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <FormProvider {...form}>
            <form id="owner-outcome-form" className="space-y-5" onSubmit={submit} noValidate>
              {offMode && <OffPlatformAssetFields branches={branches} branchScope={branchScope} disabled={busy} />}

              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {REPORT_KINDS.map((k) => (
                      <WideRadio key={k} className="h-full" on={field.value === k} onClick={() => field.onChange(k)}>
                        <span className="block text-sm font-semibold text-foreground">{REPORT_KIND_META[k].label}</span>
                      </WideRadio>
                    ))}
                  </div>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="oc-round">
                    Lượt đấu <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="oc-round"
                    inputMode="numeric"
                    className="tabular-nums"
                    disabled={busy}
                    {...form.register("roundNo")}
                  />
                  {errors.roundNo ? (
                    <OutcomeFieldError msg={errors.roundNo.message} />
                  ) : !isEdit && reported.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Đã khai {reported.length} lượt</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oc-date">
                    Ngày đấu giá <span className="text-destructive">*</span>
                  </Label>
                  <Input id="oc-date" type="date" max={today} disabled={busy} {...form.register("auctionDate")} />
                  <OutcomeFieldError msg={errors.auctionDate?.message} />
                </div>
              </div>

              {kind === "sold" ? (
                <>
                  <OutcomeSoldFields evidence={evidence} onEvidenceChange={setEvidence} disabled={busy} />
                  {isEdit && record.evidence_urls.length > 0 && !evidence && (
                    <p className="-mt-2 text-xs text-muted-foreground">Đã có biên bản — chọn tệp mới nếu muốn thay.</p>
                  )}
                </>
              ) : (
                <OutcomeNotSoldFields kind={kind} disabled={busy} />
              )}
            </form>
          </FormProvider>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button type="submit" form="owner-outcome-form" disabled={!showForm || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Lưu thay đổi" : "Lưu kết quả"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

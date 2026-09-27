import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeleteOwnerTarget, useSaveOwnerTarget } from "@/hooks/useOwnerTargets";
import type { WorkspaceBranchOption } from "@/hooks/useOwnerWorkspaceMembers";
import {
  OWNER_TARGETS_HREF,
  autoTargetName,
  findTarget,
  ownerTargetHref,
  periodOptions,
  periodStartOf,
  targetDisplayName,
  targetFormDefaults,
  targetFormSchema,
  targetScopeLabel,
  toTargetSaveArgs,
  type OwnerTarget,
  type TargetForm,
  type TargetInput,
  type TargetPeriodType,
} from "@/lib/ownerTargets";
import type { TargetSlot } from "@/lib/ownerTargetView";
import { TargetCriteriaFields } from "./TargetCriteriaFields";
import { TargetFormPreview } from "./TargetFormPreview";
import { FIELD_HINT, TargetFormSection } from "./TargetFormSection";
import { TargetPeriodFields } from "./TargetPeriodFields";

const FORM_ID = "owner-target-form";

interface TargetEditorProps {
  workspaceId: string;
  /** null ⇒ đặt mới. */
  target: OwnerTarget | null;
  /** Kỳ + phạm vi mở sẵn khi đặt mới (firstFreeSlot). */
  initialSlot: TargetSlot;
  /** Mọi chỉ tiêu của không gian — báo trùng kỳ + phạm vi. */
  targets: OwnerTarget[];
  branches: WorkspaceBranchOption[];
  inputs: TargetInput[];
  today: string;
}

/**
 * Form "Đặt chỉ tiêu" / "Sửa chỉ tiêu" (bản thiết kế): 3 khối đánh số bên trái, thẻ xem
 * trước + nút lưu / huỷ / xoá dính bên phải. Mỗi kỳ + phạm vi một chỉ tiêu: chọn trúng
 * kỳ + phạm vi của chỉ tiêu khác ⇒ cảnh báo, khoá nút lưu (server vẫn chặn bằng UNIQUE).
 */
export function TargetEditor({ workspaceId, target, initialSlot, targets, branches, inputs, today }: TargetEditorProps) {
  const navigate = useNavigate();
  const save = useSaveOwnerTarget(workspaceId);
  const remove = useDeleteOwnerTarget(workspaceId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = save.isPending || remove.isPending;
  const editing = !!target;

  const form = useForm<TargetForm>({
    resolver: zodResolver(targetFormSchema),
    // Tên để trống = tên tự sinh (ô nhập hiện tên tự sinh làm placeholder).
    defaultValues: targetFormDefaults(target, { ...initialSlot, name: "" }),
  });
  const criteria = useFieldArray({ control: form.control, name: "criteria" });
  const [periodType, periodStart, scope, name, criteriaValues] = useWatch({
    control: form.control,
    name: ["periodType", "periodStart", "scope", "name", "criteria"],
  });
  const slot: TargetSlot = { periodType, periodStart, scope };

  const starts = useMemo(() => {
    const list = periodOptions(periodType, today).map((o) => o.start);
    // Chỉ tiêu đang sửa ở kỳ xa hơn danh sách chọn ⇒ vẫn giữ kỳ của nó.
    if (target && target.periodType === periodType && !list.includes(target.periodStart)) list.unshift(target.periodStart);
    return list;
  }, [periodType, today, target]);

  const clash = findTarget(targets, periodType, periodStart, scope);
  const conflict = clash && clash.id !== target?.id ? { id: clash.id, name: targetDisplayName(clash, branches) } : null;
  const autoName = autoTargetName(periodType, periodStart, scope, branches);

  /** Đổi kỳ / phạm vi: xoá lỗi cũ và bỏ trạng thái "bấm lần nữa để xoá". */
  const retarget = (patch: Partial<TargetSlot>) => {
    const opts = { shouldDirty: true };
    if (patch.periodType) form.setValue("periodType", patch.periodType, opts);
    if (patch.periodStart) form.setValue("periodStart", patch.periodStart, opts);
    if (patch.scope) form.setValue("scope", patch.scope, opts);
    form.clearErrors();
    setConfirmDelete(false);
  };
  const pickType = (type: TargetPeriodType) => retarget({ periodType: type, periodStart: periodStartOf(type, today) });

  const submit = form.handleSubmit((values) => {
    if (conflict) return;
    save.mutate(
      toTargetSaveArgs(values, {
        workspaceId,
        targetId: target?.id ?? null,
        autoName: autoTargetName(values.periodType, values.periodStart, values.scope, branches),
      }),
      { onSuccess: (id) => navigate(ownerTargetHref(id), { replace: true }) },
    );
  });

  const onDelete = () => {
    if (!target) return;
    if (!confirmDelete) return setConfirmDelete(true);
    remove.mutate(target.id, { onSuccess: () => navigate(OWNER_TARGETS_HREF, { replace: true }) });
  };

  return (
    <div className="grid items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_320px]">
      <form id={FORM_ID} className="flex min-w-0 flex-col gap-4" onSubmit={submit} noValidate>
        <TargetFormSection no={1} title="Kỳ và phạm vi">
          <TargetPeriodFields
            slot={slot}
            starts={starts}
            today={today}
            branches={branches}
            conflict={conflict}
            disabled={busy}
            onPickType={pickType}
            onPickStart={(s) => retarget({ periodStart: s })}
            onPickScope={(s) => retarget({ scope: s })}
          />
        </TargetFormSection>

        <TargetFormSection no={2} title={<label htmlFor="target-name">Tên chỉ tiêu</label>}>
          <div className="flex flex-col gap-1.5">
            <Input
              id="target-name"
              maxLength={120}
              placeholder={autoName}
              disabled={busy}
              aria-describedby="target-name-count"
              className="rounded-lg"
              {...form.register("name")}
            />
            <span id="target-name-count" className={cn(FIELD_HINT, "tabular-nums")}>
              {form.formState.errors.name?.message ?? `${name.length}/120`}
            </span>
          </div>
        </TargetFormSection>

        <TargetFormSection
          no={3}
          title={
            <>
              Tiêu chí <span className="font-medium tabular-nums text-muted-foreground">{criteria.fields.length}/4</span>
            </>
          }
        >
          <TargetCriteriaFields form={form} fieldArray={criteria} slot={slot} inputs={inputs} disabled={busy} />
        </TargetFormSection>
      </form>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-5">
        <TargetFormPreview
          slot={slot}
          name={name}
          scopeLabel={targetScopeLabel(scope, branches)}
          criteria={criteriaValues}
          today={today}
        />
        <div className="flex flex-col gap-2">
          <Button type="submit" form={FORM_ID} className="h-10 font-semibold" disabled={busy || !!conflict}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Lưu thay đổi" : "Lưu chỉ tiêu"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 bg-card font-semibold"
            disabled={busy}
            onClick={() => navigate(target ? ownerTargetHref(target.id) : OWNER_TARGETS_HREF)}
          >
            Huỷ
          </Button>
          {editing && (
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className={cn(
                "flex items-center justify-center rounded-lg p-2 text-[13px] font-semibold transition-colors disabled:opacity-60",
                confirmDelete
                  ? "bg-destructive text-destructive-foreground"
                  : "text-destructive hover:bg-destructive/10",
              )}
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmDelete ? "Bấm lần nữa để xoá" : "Xoá chỉ tiêu"}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

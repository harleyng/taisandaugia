import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CpdActivityRole, CpdActivityType, CpdCreditMode } from "@/types/cpd-catalog";
import { useCpdCatalogAdmin } from "@/hooks/useCpdCatalogAdmin";
import { CreditRuleFields } from "./CreditRuleFields";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activityType: CpdActivityType;
  existing?: CpdActivityRole;
}

export function ActivityRoleDialog({ open, onOpenChange, activityType, existing }: Props) {
  const { saveRole } = useCpdCatalogAdmin();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creditMode, setCreditMode] = useState<CpdCreditMode>("HOURS");
  const [fixedHours, setFixedHours] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCode(existing?.code ?? "");
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setCreditMode(existing?.creditMode ?? "HOURS");
    setFixedHours(existing?.fixedHours != null ? String(existing.fixedHours) : "");
    setIsActive(existing?.isActive ?? true);
  }, [open, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = code.trim().length > 0 && name.trim().length > 0;

  const submit = () => {
    saveRole.mutate(
      {
        id: existing?.id,
        activityTypeId: activityType.id,
        code,
        name,
        description,
        creditMode,
        fixedHours: fixedHours === "" ? undefined : Number(fixedHours),
        sortOrder: existing?.sortOrder
          ?? (activityType.roles.length + 1) * 10,
        isActive,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {existing ? "Sửa" : "Thêm"} vai trò — {activityType.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Mã <span className="text-destructive">*</span></label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ATTENDEE"
                disabled={!!existing}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Tên vai trò <span className="text-destructive">*</span></label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Người tham dự" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Mô tả</label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <CreditRuleFields
            creditMode={creditMode}
            fixedHours={fixedHours}
            onCreditMode={setCreditMode}
            onFixedHours={setFixedHours}
            scopeHint="Cách tính của vai trò này THẮNG cấu hình của hình thức."
          />

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm">Đang hoạt động</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button size="sm" disabled={!canSave || saveRole.isPending} onClick={submit}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

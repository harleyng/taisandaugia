import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CpdActivityType, CpdCreditMode } from "@/types/cpd-catalog";
import { useCpdCatalogAdmin } from "@/hooks/useCpdCatalogAdmin";
import { CreditRuleFields } from "./CreditRuleFields";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: CpdActivityType;
  /** Thứ tự gợi ý cho mục mới — đặt cuối danh sách. */
  nextSortOrder: number;
}

export function ActivityTypeDialog({ open, onOpenChange, existing, nextSortOrder }: Props) {
  const { saveType } = useCpdCatalogAdmin();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [legalBasis, setLegalBasis] = useState("");
  const [hasRoles, setHasRoles] = useState(false);
  const [creditMode, setCreditMode] = useState<CpdCreditMode>("HOURS");
  const [fixedHours, setFixedHours] = useState("");
  const [titleLabel, setTitleLabel] = useState("Tên hoạt động");
  const [orgLabel, setOrgLabel] = useState("Đơn vị tổ chức");
  const [evidenceHint, setEvidenceHint] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCode(existing?.code ?? "");
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setLegalBasis(existing?.legalBasis ?? "");
    setHasRoles(existing?.hasRoles ?? false);
    setCreditMode(existing?.creditMode ?? "HOURS");
    setFixedHours(existing?.fixedHours != null ? String(existing.fixedHours) : "");
    setTitleLabel(existing?.titleLabel ?? "Tên hoạt động");
    setOrgLabel(existing?.orgLabel ?? "Đơn vị tổ chức");
    setEvidenceHint(existing?.evidenceHint ?? "");
    setIsActive(existing?.isActive ?? true);
  }, [open, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = code.trim().length > 0 && name.trim().length > 0;

  const submit = () => {
    saveType.mutate(
      {
        id: existing?.id,
        code,
        name,
        description,
        legalBasis,
        hasRoles,
        creditMode,
        fixedHours: fixedHours === "" ? undefined : Number(fixedHours),
        titleLabel,
        orgLabel,
        evidenceHint,
        sortOrder: existing?.sortOrder ?? nextSortOrder,
        isActive,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {existing ? "Sửa" : "Thêm"} hình thức bồi dưỡng
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cấu hình ở đây quyết định một hoạt động được tính vào nghĩa vụ bồi
            dưỡng như thế nào, và <strong>áp dụng hồi tố cho mọi năm</strong> —
            sửa quy đổi giờ sẽ làm đổi kết quả tuân thủ của các năm đã qua.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Mã <span className="text-destructive">*</span></label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SEMINAR"
                // Mã là khoá đối chiếu của dữ liệu đã ghi — đổi mã của mục đang
                // dùng sẽ làm lệch mọi đối soát về sau.
                disabled={!!existing}
              />
              {existing && (
                <p className="text-xs text-muted-foreground">Mã không sửa được sau khi tạo.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Căn cứ pháp lý</label>
              <Input
                value={legalBasis}
                onChange={(e) => setLegalBasis(e.target.value)}
                placeholder="Điều 26.2"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Tên hình thức <span className="text-destructive">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Mô tả</label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hiện ngay dưới ô chọn khi tổ chức khai báo."
            />
          </div>

          <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="text-sm">Phân theo vai trò</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Bật khi cùng một hoạt động được tính khác nhau tuỳ vai trò — ví dụ
                báo cáo viên hội thảo hoàn thành cả năm, còn người tham dự chỉ được
                quy đổi ít giờ. Khi bật, cách tính lấy từ từng vai trò.
              </span>
            </span>
            <Switch checked={hasRoles} onCheckedChange={setHasRoles} />
          </label>

          {!hasRoles && (
            <CreditRuleFields
              creditMode={creditMode}
              fixedHours={fixedHours}
              onCreditMode={setCreditMode}
              onFixedHours={setFixedHours}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nhãn ô "tên"</label>
              <Input value={titleLabel} onChange={(e) => setTitleLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nhãn ô "đơn vị"</label>
              <Input value={orgLabel} onChange={(e) => setOrgLabel(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Gợi ý giấy tờ xác nhận</label>
            <Textarea
              rows={2}
              value={evidenceHint}
              onChange={(e) => setEvidenceHint(e.target.value)}
              placeholder="Chứng chỉ hoặc giấy chứng nhận tham gia lớp bồi dưỡng (Điều 27.1)."
            />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="text-sm">Đang hoạt động</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Tắt để ẩn khỏi ô chọn. Bản ghi cũ vẫn giữ nguyên nhãn.
              </span>
            </span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button size="sm" disabled={!canSave || saveType.isPending} onClick={submit}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

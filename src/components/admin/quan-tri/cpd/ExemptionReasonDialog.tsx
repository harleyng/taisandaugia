import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CpdExemptionReasonDef } from "@/types/cpd-catalog";
import { useCpdCatalogAdmin } from "@/hooks/useCpdCatalogAdmin";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: CpdExemptionReasonDef;
  nextSortOrder: number;
}

export function ExemptionReasonDialog({ open, onOpenChange, existing, nextSortOrder }: Props) {
  const { saveReason } = useCpdCatalogAdmin();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [legalBasis, setLegalBasis] = useState("");
  const [requiresEvidence, setRequiresEvidence] = useState(true);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCode(existing?.code ?? "");
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setLegalBasis(existing?.legalBasis ?? "");
    setRequiresEvidence(existing?.requiresEvidence ?? true);
    setIsActive(existing?.isActive ?? true);
  }, [open, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = code.trim().length > 0 && name.trim().length > 0;

  const submit = () => {
    saveReason.mutate(
      {
        id: existing?.id,
        code,
        name,
        description,
        legalBasis,
        requiresEvidence,
        sortOrder: existing?.sortOrder ?? nextSortOrder,
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
            {existing ? "Sửa" : "Thêm"} trường hợp được miễn
          </DialogTitle>
          <DialogDescription className="text-xs">
            Danh sách này hiện ra cho tổ chức chọn khi đánh dấu đấu giá viên được
            miễn nghĩa vụ bồi dưỡng trong năm (Điều 26.3 TT 19/2024/TT-BTP).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Mã <span className="text-destructive">*</span></label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="MATERNITY"
                disabled={!!existing}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Căn cứ pháp lý</label>
              <Input
                value={legalBasis}
                onChange={(e) => setLegalBasis(e.target.value)}
                placeholder="Điều 26.3"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Tên trường hợp <span className="text-destructive">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Giấy tờ cần nộp</label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hiện dưới ô tải tệp để tổ chức biết phải nộp giấy gì."
            />
          </div>

          <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="text-sm">Bắt buộc có minh chứng</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Bật thì tổ chức không lưu được diện miễn khi chưa đính kèm giấy tờ.
              </span>
            </span>
            <Switch checked={requiresEvidence} onCheckedChange={setRequiresEvidence} />
          </label>

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
          <Button size="sm" disabled={!canSave || saveReason.isPending} onClick={submit}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

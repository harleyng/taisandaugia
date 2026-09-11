import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { CONTRACT_FILE_ACCEPT, validateContractFile } from "@/lib/consignment/contractFiles";

export interface AttachSignedValues {
  file: File;
  signedDate: string;
  contractNo: string;
  confirm: boolean;
}

interface AttachSignedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  defaultContractNo?: string | null;
  /** Đã có bản ký trước đó — cảnh báo tải bản mới sẽ xoá các xác nhận. */
  replacing?: boolean;
  onSubmit: (values: AttachSignedValues) => void;
}

/** Tải bản scan hợp đồng hai bên đã ký (PDF/JPG/PNG ≤ 10MB). */
export function AttachSignedDialog({
  open,
  onOpenChange,
  isPending,
  defaultContractNo,
  replacing,
  onSubmit,
}: AttachSignedDialogProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [file, setFile] = useState<File | null>(null);
  const [signedDate, setSignedDate] = useState(today);
  const [contractNo, setContractNo] = useState(defaultContractNo ?? "");
  const [confirm, setConfirm] = useState(true);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setSignedDate(format(new Date(), "yyyy-MM-dd"));
    setContractNo(defaultContractNo ?? "");
    setConfirm(true);
  }, [open, defaultContractNo]);

  const pickFile = (f: File | null) => {
    if (!f) return setFile(null);
    const invalid = validateContractFile(f);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setFile(f);
  };

  const canSubmit = !!file && !!signedDate && signedDate <= today && !isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tải bản hợp đồng đã ký</DialogTitle>
          <DialogDescription>
            Bản scan hợp đồng dịch vụ đấu giá có đủ chữ ký, dấu của hai bên. Hợp đồng có hiệu lực trên sàn khi cả
            hai bên xác nhận đúng tệp này.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="signed-file">Tệp hợp đồng đã ký (PDF/JPG/PNG, ≤ 10MB)</Label>
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Bỏ tệp đã chọn"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Input
                id="signed-file"
                type="file"
                accept={CONTRACT_FILE_ACCEPT}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="signed-date">Ngày ký</Label>
              <Input
                id="signed-date"
                type="date"
                max={today}
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contract-no">Số hợp đồng</Label>
              <Input
                id="contract-no"
                value={contractNo}
                onChange={(e) => setContractNo(e.target.value)}
                placeholder="VD: 15/2026/HĐDV"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" />
            <span>Tôi xác nhận đây là bản hợp đồng hai bên đã ký.</span>
          </label>

          {replacing && (
            <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-foreground">
              Bản mới sẽ thay bản đã tải trước đó và xoá mọi xác nhận — hai bên cần xác nhận lại.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Để sau
          </Button>
          <Button
            onClick={() => file && onSubmit({ file, signedDate, contractNo, confirm })}
            disabled={!canSubmit}
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tải lên
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

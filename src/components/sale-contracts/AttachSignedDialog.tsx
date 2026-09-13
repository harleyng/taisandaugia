import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoBox } from "@/components/shared/InfoBox";
import { SALE_FILE_ACCEPT, validateSaleFile } from "@/lib/saleContracts/files";

export interface AttachSignedValues {
  file: File;
  signedDate: string;
  contractNo: string;
  confirm: boolean;
}

/** Ngày hôm nay theo giờ Việt Nam — server cũng chặn ngày ký ở tương lai. */
const todayVN = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

export function AttachSignedDialog({
  open, onOpenChange, isPending, defaultContractNo, replacing, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
  defaultContractNo?: string | null;
  replacing: boolean;
  onSubmit: (v: AttachSignedValues) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [signedDate, setSignedDate] = useState(todayVN());
  const [contractNo, setContractNo] = useState("");
  const [confirm, setConfirm] = useState(true);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setSignedDate(todayVN());
    setContractNo(defaultContractNo ?? "");
    setConfirm(true);
  }, [open, defaultContractNo]);

  const pick = (f: File | null) => {
    if (!f) return;
    const invalid = validateSaleFile(f);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tải lên bản hợp đồng đã ký</DialogTitle>
          <DialogDescription>
            Tải bản scan hợp đồng có đủ chữ ký. Các bên sẽ xác nhận trên chính tệp này.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {replacing ? (
            <InfoBox variant="amber">
              Thay tệp mới sẽ xoá mọi xác nhận hiện có — các bên phải xác nhận lại.
            </InfoBox>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="sale-signed-file">Bản scan đã ký</Label>
            <Input
              id="sale-signed-file"
              type="file"
              accept={SALE_FILE_ACCEPT}
              disabled={isPending}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            {file ? <p className="text-xs text-muted-foreground break-all">{file.name}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sale-signed-date">Ngày ký</Label>
              <Input
                id="sale-signed-date"
                type="date"
                max={todayVN()}
                value={signedDate}
                disabled={isPending}
                onChange={(e) => setSignedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-contract-no">Số hợp đồng</Label>
              <Input
                id="sale-contract-no"
                value={contractNo}
                placeholder="01/2026/HĐMB"
                disabled={isPending}
                onChange={(e) => setContractNo(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={confirm}
              disabled={isPending}
              onCheckedChange={(v) => setConfirm(v === true)}
            />
            <span>Đồng thời xác nhận bản ký này thay cho bên của tôi</span>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={!file || !signedDate || isPending}
            onClick={() => file && onSubmit({ file, signedDate, contractNo: contractNo.trim(), confirm })}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Tải lên
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

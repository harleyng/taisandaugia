import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCompleteValuation } from "@/hooks/useAdminValuationOrders";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import { defaultValidUntil } from "@/lib/valuation/paths";
import { METHOD_LABELS } from "@/lib/valuation/status";
import type { ValuationMethod, ValuationOrder } from "@/types/valuation";

const MAX_BYTES = 10 * 1024 * 1024;
const METHODS = Object.keys(METHOD_LABELS) as ValuationMethod[];
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

const Req = () => <span className="ml-0.5 text-destructive">*</span>;

/**
 * Nhập kết quả + tải chứng thư PDF THAY đơn vị thẩm định (BR-TDG-01). File lên bucket trước,
 * RPC kiểm file có thật rồi mới chốt và ghi hoa hồng. Không đổi giá khởi điểm (BR-TDG-03).
 */
export function CompleteValuationDialog({
  order,
  open,
  onOpenChange,
}: {
  order: ValuationOrder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const complete = useCompleteValuation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(0);
  const [valuationDate, setValuationDate] = useState(today());
  const [validUntil, setValidUntil] = useState(defaultValidUntil(today()));
  const [method, setMethod] = useState<ValuationMethod>("comparison");
  const [summary, setSummary] = useState("");
  const [certNo, setCertNo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(0);
    setValuationDate(today());
    setValidUntil(defaultValidUntil(today()));
    setMethod("comparison");
    setSummary("");
    setCertNo("");
    setFile(null);
    setFileError(null);
  }, [open]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf") return setFileError("Chứng thư phải là file PDF.");
    if (f.size > MAX_BYTES) return setFileError("File tối đa 10MB.");
    setFileError(null);
    setFile(f);
  };

  const changeDate = (d: string) => {
    // Hạn hiệu lực đi theo ngày thẩm định khi người nhập chưa tự sửa hạn.
    if (validUntil === defaultValidUntil(valuationDate)) setValidUntil(d ? defaultValidUntil(d) : "");
    setValuationDate(d);
  };

  const dateOk = !!valuationDate && valuationDate <= today();
  const valid = !!file && value > 0 && dateOk && !!validUntil && validUntil >= valuationDate;

  return (
    <Dialog open={open} onOpenChange={(v) => !complete.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kết quả thẩm định giá · {order.code}</DialogTitle>
          <DialogDescription>
            Nhập thay đơn vị <span className="font-semibold text-foreground">{order.partner_name}</span>. Người bán không
            tải được chứng thư. Sau khi lưu, hệ thống ghi nhận hoa hồng đơn vị thẩm định.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tdg-value">
              Giá trị thẩm định (₫)
              <Req />
            </Label>
            <Input
              id="tdg-value"
              inputMode="numeric"
              value={value ? groupNumber(value) : ""}
              placeholder="0"
              onChange={(e) => setValue(parseNumber(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tdg-date">
                Ngày thẩm định
                <Req />
              </Label>
              <Input id="tdg-date" type="date" max={today()} value={valuationDate} onChange={(e) => changeDate(e.target.value)} />
              {!dateOk && valuationDate && <p className="text-xs text-destructive">Không được sau hôm nay.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tdg-until">
                Hiệu lực đến
                <Req />
              </Label>
              <Input
                id="tdg-until"
                type="date"
                min={valuationDate}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tdg-method">
              Phương pháp
              <Req />
            </Label>
            <Select value={method} onValueChange={(v) => setMethod(v as ValuationMethod)}>
              <SelectTrigger id="tdg-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tdg-cert-no">Số chứng thư</Label>
            <Input id="tdg-cert-no" value={certNo} maxLength={200} onChange={(e) => setCertNo(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tdg-summary">Nhận xét gửi người bán</Label>
            <Textarea
              id="tdg-summary"
              rows={3}
              maxLength={4000}
              value={summary}
              placeholder="VD: Giá trị dựa trên 3 giao dịch tương đồng trong bán kính 500 m…"
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Chứng thư PDF
              <Req />
            </Label>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              {file ? <FileText className="mr-1.5 h-3.5 w-3.5" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
              {file ? file.name : "Chọn file PDF (≤ 10MB)"}
            </Button>
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={complete.isPending}>
            Huỷ
          </Button>
          <Button
            disabled={!valid || complete.isPending}
            onClick={() =>
              file &&
              complete.mutate(
                {
                  orderId: order.id,
                  postingId: order.asset_posting_id,
                  value,
                  valuationDate,
                  validUntil,
                  method,
                  summary: summary.trim(),
                  certificateNo: certNo.trim(),
                  file,
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {complete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu kết quả
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

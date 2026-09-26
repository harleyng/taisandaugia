import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatVnd } from "@/lib/advertising/slug";
import { useRequestVrTour, useVrTourCatalog } from "@/hooks/useVrTourOrders";

interface AddVrTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Trả id hồ sơ — trong wizard tự lưu nháp nếu chưa có. null = chưa lưu được (hàm tự báo lỗi). */
  resolvePostingId: () => Promise<string | null>;
}

/** "Thêm VR tour": chọn gói + đối tác, mô tả hiện trường ⇒ gửi yêu cầu cho sàn báo giá. */
export function AddVrTourDialog({ open, onOpenChange, resolvePostingId }: AddVrTourDialogProps) {
  const { data: catalog, isLoading, error } = useVrTourCatalog(open);
  const request = useRequestVrTour();
  const [variantKey, setVariantKey] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [note, setNote] = useState("");
  const [preparing, setPreparing] = useState(false);

  const packages = useMemo(() => catalog?.packages ?? [], [catalog]);
  const partners = useMemo(() => catalog?.partners ?? [], [catalog]);

  // Chỉ một đối tác ⇒ chọn sẵn; gói đầu tiên chọn sẵn để người bán chỉ cần đổi khi cần.
  useEffect(() => {
    if (!open) return;
    if (!supplierId && partners.length === 1) setSupplierId(partners[0].supplier_id);
    if (!variantKey && packages.length > 0) setVariantKey(packages[0].variant_key);
  }, [open, partners, packages, supplierId, variantKey]);

  const busy = preparing || request.isPending;
  const canSubmit = !!variantKey && !!supplierId && siteAddress.trim().length >= 5 && !busy;

  const submit = async () => {
    setPreparing(true);
    const postingId = await resolvePostingId();
    setPreparing(false);
    if (!postingId) return;
    request.mutate(
      { postingId, variantKey, supplierId, siteAddress, preferredTime, note },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSiteAddress("");
          setPreferredTime("");
          setNote("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm VR tour</DialogTitle>
          <DialogDescription>
            Đối tác chụp và dựng tour thực tế ảo để người mua đi xem không gian tài sản. Sàn sẽ gửi báo giá chính thức
            trước khi bạn thanh toán.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải gói dịch vụ…
          </div>
        ) : error || packages.length === 0 || partners.length === 0 ? (
          <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Dịch vụ VR tour đang tạm ngưng nhận đơn. Vui lòng thử lại sau.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Gói dịch vụ</Label>
              <RadioGroup value={variantKey} onValueChange={setVariantKey} className="gap-2">
                {packages.map((p) => (
                  <label
                    key={p.variant_key}
                    htmlFor={`vr-pkg-${p.variant_key}`}
                    className={[
                      "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                      variantKey === p.variant_key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    ].join(" ")}
                  >
                    <RadioGroupItem id={`vr-pkg-${p.variant_key}`} value={p.variant_key} />
                    <span className="flex-1 text-sm font-medium text-foreground">{p.name}</span>
                    <span className="text-xs text-muted-foreground">từ {formatVnd(p.from_price)}</span>
                  </label>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">Giá chính thức theo báo giá sau khi sàn xem thông tin hiện trường.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vr-partner">Đối tác thực hiện</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="vr-partner">
                  <SelectValue placeholder="Chọn đối tác" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.supplier_id} value={p.supplier_id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vr-address">Địa chỉ hiện trường</Label>
              <Input
                id="vr-address"
                value={siteAddress}
                maxLength={500}
                placeholder="Số nhà, đường, khu công nghiệp…"
                onChange={(e) => setSiteAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vr-time">
                Thời gian mong muốn <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
              </Label>
              <Input
                id="vr-time"
                value={preferredTime}
                maxLength={200}
                placeholder="VD: sáng thứ Bảy tuần sau"
                onChange={(e) => setPreferredTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vr-note">
                Ghi chú cho đối tác <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
              </Label>
              <Textarea
                id="vr-note"
                rows={3}
                value={note}
                maxLength={1000}
                placeholder="Diện tích, số tầng/khu vực cần chụp, người liên hệ tại hiện trường…"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Đóng
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi yêu cầu báo giá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

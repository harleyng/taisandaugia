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
import { GD_METHOD_DESCRIPTIONS } from "@/lib/authentication/status";
import { useAuthenticationCatalog, useRequestAuthentication } from "@/hooks/useAuthenticationOrders";
import type { AuthenticationMethod } from "@/types/authentication";

interface OrderAuthenticationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Trả id hồ sơ — trong wizard tự lưu nháp nếu chưa có. null = chưa lưu được (hàm tự báo lỗi). */
  resolvePostingId: () => Promise<string | null>;
}

const methodOf = (variantKey: string) => variantKey.replace(/^gd_/, "") as AuthenticationMethod;

/** "Đặt giám định": chọn đối tác + phương thức ⇒ gửi yêu cầu cho sàn báo giá. */
export function OrderAuthenticationDialog({ open, onOpenChange, resolvePostingId }: OrderAuthenticationDialogProps) {
  const { data: catalog, isLoading, error } = useAuthenticationCatalog(open);
  const request = useRequestAuthentication();
  const [variantKey, setVariantKey] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [note, setNote] = useState("");
  const [preparing, setPreparing] = useState(false);

  const packages = useMemo(() => catalog?.packages ?? [], [catalog]);
  const partners = useMemo(() => catalog?.partners ?? [], [catalog]);

  useEffect(() => {
    if (!open) return;
    if (!supplierId && partners.length === 1) setSupplierId(partners[0].supplier_id);
    if (!variantKey && packages.length > 0) setVariantKey(packages[0].variant_key);
  }, [open, partners, packages, supplierId, variantKey]);

  const method = methodOf(variantKey);
  const onSite = method === "on_site";
  const busy = preparing || request.isPending;
  const canSubmit = !!variantKey && !!supplierId && (!onSite || siteAddress.trim().length >= 5) && !busy;

  const submit = async () => {
    setPreparing(true);
    const postingId = await resolvePostingId();
    setPreparing(false);
    if (!postingId) return;
    request.mutate(
      { postingId, method, supplierId, siteAddress: onSite ? siteAddress : "", preferredTime, note },
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
          <DialogTitle>Đặt giám định</DialogTitle>
          <DialogDescription>
            Đối tác giám định độc lập cấp chứng thư cho tài sản. Lô có chứng thư “xác thực” được gắn huy hiệu “Đã giám
            định” và tăng mức xác minh. Sàn gửi báo giá chính thức trước khi bạn thanh toán.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải dịch vụ giám định…
          </div>
        ) : error || packages.length === 0 || partners.length === 0 ? (
          <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Dịch vụ giám định đang tạm ngưng nhận đơn. Vui lòng thử lại sau.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gd-partner">
                Đối tác giám định <span className="text-destructive">*</span>
              </Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="gd-partner">
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

            <div className="space-y-2">
              <Label>
                Phương thức <span className="text-destructive">*</span>
              </Label>
              <RadioGroup value={variantKey} onValueChange={setVariantKey} className="gap-2">
                {packages.map((p) => (
                  <label
                    key={p.variant_key}
                    htmlFor={`gd-pkg-${p.variant_key}`}
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      variantKey === p.variant_key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    ].join(" ")}
                  >
                    <RadioGroupItem id={`gd-pkg-${p.variant_key}`} value={p.variant_key} className="mt-0.5" />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-foreground">{p.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {GD_METHOD_DESCRIPTIONS[methodOf(p.variant_key)]}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">từ {formatVnd(p.from_price)}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {onSite && (
              <div className="space-y-1.5">
                <Label htmlFor="gd-address">
                  Địa chỉ nơi đặt hiện vật <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="gd-address"
                  value={siteAddress}
                  maxLength={500}
                  placeholder="Số nhà, đường, phường, tỉnh/thành"
                  onChange={(e) => setSiteAddress(e.target.value)}
                />
              </div>
            )}
            {method === "ship_item" && (
              <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                Sau khi thanh toán, sàn gửi địa chỉ nhận hiện vật của đối tác. Bạn đóng gói, gửi và nhập mã vận đơn ngay
                trong hồ sơ.
              </p>
            )}
            {method !== "from_photos" && (
              <div className="space-y-1.5">
                <Label htmlFor="gd-time">Thời gian thuận tiện</Label>
                <Input
                  id="gd-time"
                  value={preferredTime}
                  maxLength={200}
                  placeholder="VD: các buổi chiều trong tuần"
                  onChange={(e) => setPreferredTime(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="gd-note">Ghi chú cho đối tác</Label>
              <Textarea
                id="gd-note"
                rows={3}
                value={note}
                maxLength={1000}
                placeholder="Nguồn gốc, niên đại ước đoán, giấy tờ kèm theo, chi tiết cần chú ý…"
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

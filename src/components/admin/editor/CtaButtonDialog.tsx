import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsert: (attrs: { label: string; href: string }) => void;
}

export function CtaButtonDialog({ open, onOpenChange, onInsert }: Props) {
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("https://");
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setLabel("");
    setHref("https://");
    setErr(null);
  };
  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const submit = () => {
    const l = label.trim();
    const h = href.trim();
    if (!l) return setErr("Vui lòng nhập nhãn nút");
    if (!/^https:\/\/.+/i.test(h)) return setErr("Link phải bắt đầu bằng https://");
    onInsert({ label: l, href: h });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chèn nút CTA</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="cta-label">Nhãn nút</Label>
            <Input
              id="cta-label"
              value={label}
              maxLength={40}
              placeholder="Ví dụ: Tải tài liệu"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cta-href">Link điều hướng</Label>
            <Input
              id="cta-href"
              value={href}
              placeholder="https://…"
              onChange={(e) => setHref(e.target.value)}
            />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Huỷ
          </Button>
          <Button onClick={submit}>Chèn nút</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import type { PostMetrics } from "@/lib/ownerMarketing/orderReport";

interface PostMetricsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  initial: PostMetrics | null;
  isPending: boolean;
  onSubmit: (v: { reach: number; engagements: number; clicks: number }) => Promise<unknown>;
}

const FIELDS = [
  { key: "reach", label: "Tiếp cận", hint: "Số người đã thấy bài (Meta Insights → Lượt tiếp cận)" },
  { key: "engagements", label: "Tương tác", hint: "Cảm xúc + bình luận + chia sẻ" },
  { key: "clicks", label: "Lượt bấm về tin", hint: "Lượt bấm link dẫn về trang tài sản" },
] as const;
type Key = (typeof FIELDS)[number]["key"];

/** Số liệu bài đăng fanpage — Facebook không cho sàn đọc tự động nên nhập tay từ Insights. */
export function PostMetricsDialog({ open, onOpenChange, code, initial, isPending, onSubmit }: PostMetricsDialogProps) {
  const [v, setV] = useState<Record<Key, string>>({ reach: "", engagements: "", clicks: "" });

  useEffect(() => {
    if (!open) return;
    setV({
      reach: initial ? groupNumber(initial.reach) : "",
      engagements: initial ? groupNumber(initial.engagements) : "",
      clicks: initial ? groupNumber(initial.clicks) : "",
    });
  }, [open, initial]);

  const nums = { reach: parseNumber(v.reach), engagements: parseNumber(v.engagements), clicks: parseNumber(v.clicks) };
  const valid = FIELDS.every((f) => v[f.key].trim() !== "");

  const submit = () =>
    onSubmit(nums).then(
      () => onOpenChange(false),
      (): void => undefined,
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Số liệu bài đăng · {code}</DialogTitle>
          <DialogDescription>Chủ tài sản thấy các số này trong mục “Kết quả truyền thông” của đơn.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`pm-${f.key}`}>
                {f.label} <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`pm-${f.key}`}
                inputMode="numeric"
                value={v[f.key]}
                onChange={(e) => {
                  // Tách nhóm 3 chữ số bằng dấu phẩy ngay khi gõ; ô trống vẫn là trống (bắt buộc nhập).
                  const digits = e.target.value.replace(/\D/g, "");
                  setV((p) => ({ ...p, [f.key]: digits === "" ? "" : groupNumber(Number(digits)) }));
                }}
              />
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button disabled={!valid || isPending} onClick={submit}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu số liệu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUpsertTool } from "@/hooks/useAuctionTools";
import type { AuctionTool } from "@/types/auctionTools";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tool: AuctionTool | null;
}

/** Sửa nội dung 1 công cụ (name/tagline/description/icon). 4 công cụ cố định,
 *  chỉ sửa nội dung — không tạo/xoá. */
export function ToolContentDialog({ open, onOpenChange, tool }: Props) {
  const upsert = useUpsertTool();
  const [form, setForm] = useState({ name: "", tagline: "", description: "", icon: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open && tool) {
      setForm({
        name: tool.name,
        tagline: tool.tagline ?? "",
        description: tool.description ?? "",
        icon: tool.icon ?? "",
      });
    }
  }, [open, tool]);

  const save = async () => {
    if (!tool) return;
    if (!form.name.trim()) return toast.error("Nhập tên công cụ");
    try {
      await upsert.mutateAsync({
        id: tool.id,
        name: form.name.trim(),
        tagline: form.tagline.trim() || null,
        description: form.description.trim() || null,
        icon: form.icon.trim() || null,
      });
      toast.success("Đã cập nhật công cụ");
      onOpenChange(false);
    } catch {
      toast.error("Lưu thất bại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa nội dung công cụ</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên công cụ</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>Tagline</Label>
            <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Icon (tên lucide-react, vd ScanLine)</Label>
            <Input value={form.icon} onChange={(e) => set("icon", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={save} disabled={upsert.isPending}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

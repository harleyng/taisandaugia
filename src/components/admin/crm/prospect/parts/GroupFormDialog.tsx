import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpsertProspectGroup } from "@/hooks/useProspects";
import type { ProspectGroup, ProspectKind } from "@/lib/prospects/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: ProspectKind;
  parentId: string;
  /** Có giá trị = đổi tên cụm sẵn có; null = tạo cụm mới. */
  editing: ProspectGroup | null;
  /** Cụm vừa tạo xong — để nơi gọi xếp luôn các dòng đang chọn vào đó. */
  onCreated?: (groupId: string) => void;
}

export function GroupFormDialog({
  open, onOpenChange, kind, parentId, editing, onCreated,
}: Props) {
  const [name, setName] = useState("");
  const upsert = useUpsertProspectGroup();

  useEffect(() => {
    if (open) setName(editing?.name ?? "");
  }, [open, editing]);

  const handleSubmit = async () => {
    const v = name.trim();
    if (!v) return;
    try {
      const res = await upsert.mutateAsync({
        kind, parentId, name: v, groupId: editing?.id ?? null,
      });
      toast.success(editing ? "Đã đổi tên cụm" : `Đã tạo cụm "${v}"`);
      if (!editing && res?.id) onCreated?.(res.id);
      onOpenChange(false);
    } catch {
      // Ràng buộc UNIQUE(kind, parent_id, name) là lỗi hay gặp nhất ở đây.
      toast.error("Không lưu được — có thể tên cụm đã tồn tại ở đơn vị này");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Đổi tên cụm" : "Tạo cụm mới"}</DialogTitle>
          <DialogDescription>
            Cụm là cách bạn gom nhóm các đơn vị thành viên để dễ quản lý, ví dụ &quot;Cụm miền
            Bắc&quot;. Cụm chỉ thuộc về đơn vị này, không dùng chung với pháp nhân khác.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="group-name">Tên cụm</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="VD: Cụm miền Bắc"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!name.trim() || upsert.isPending} onClick={handleSubmit}>
            {upsert.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {editing ? "Lưu" : "Tạo cụm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

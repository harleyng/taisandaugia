import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateRole, useUpdateRole } from "@/hooks/useAdminRoles";
import type { AdminRole } from "@/types/adminRbac";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  role?: AdminRole | null; // truyền vào => chế độ sửa
  onCreated?: (role: AdminRole) => void;
}

const normalizeCode = (v: string) =>
  v.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function RoleFormDialog({ open, onOpenChange, role, onCreated }: Props) {
  const isEdit = !!role;
  const create = useCreateRole();
  const update = useUpdateRole();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(role?.name ?? "");
      setCode(role?.code ?? "");
      setDescription(role?.description ?? "");
    }
  }, [open, role]);

  const busy = create.isPending || update.isPending;

  const submit = async () => {
    const n = name.trim();
    const c = normalizeCode(code);
    if (n.length < 2) return toast.error("Tên vai trò tối thiểu 2 ký tự");
    if (!isEdit && c.length < 2) return toast.error("Mã vai trò tối thiểu 2 ký tự");
    try {
      if (isEdit && role) {
        await update.mutateAsync({ id: role.id, name: n, description });
        toast.success("Đã cập nhật vai trò");
      } else {
        const created = await create.mutateAsync({ name: n, code: c, description });
        toast.success("Đã tạo vai trò");
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(isEdit ? "Cập nhật thất bại" : "Tạo vai trò thất bại", {
        description: (err as Error).message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa vai trò" : "Tạo vai trò mới"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cập nhật tên và mô tả. Mã vai trò không đổi được."
              : "Đặt tên và mã. Quyền được cấu hình ở trang chi tiết sau khi tạo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Tên vai trò <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Biên tập viên" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Mã <span className="text-destructive">*</span></Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onBlur={() => setCode(normalizeCode(code))}
              placeholder="VD: EDITOR"
              disabled={isEdit}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Chữ HOA, số và dấu _ (tự chuẩn hóa). Không đổi sau khi tạo.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Vai trò này dùng cho…" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Hủy</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {isEdit ? "Lưu" : "Tạo vai trò"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateOwnerWsRole, useUpdateOwnerWsRole } from "@/hooks/useOwnerWsRoles";
import { OwnerWsRpcError, ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";
import type { OwnerWsRoleRow } from "@/types/ownerRbac";

const NO_COPY = "none";

const schema = z.object({
  name: z.string().trim().min(2, "Tên vai trò tối thiểu 2 ký tự.").max(60, "Tối đa 60 ký tự."),
  description: z.string().trim().max(300, "Tối đa 300 ký tự."),
  copyFrom: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Có ⇒ sửa tên / mô tả; không ⇒ tạo mới. */
  role?: OwnerWsRoleRow | null;
  /** Vai trò có thể sao chép quyền khi tạo mới (đã lọc theo quyền của người tạo). */
  copyable?: OwnerWsRoleRow[];
  onCreated?: (roleId: string) => void;
}

/** Tạo / sửa vai trò: tên + mô tả (+ sao chép quyền từ vai trò có sẵn khi tạo). */
export function OwnerRoleFormDialog({ open, onOpenChange, workspaceId, role, copyable = [], onCreated }: Props) {
  const isEdit = !!role;
  const create = useCreateOwnerWsRole(workspaceId);
  const update = useUpdateOwnerWsRole(workspaceId);
  const busy = create.isPending || update.isPending;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", copyFrom: NO_COPY },
  });

  useEffect(() => {
    if (open) form.reset({ name: role?.name ?? "", description: role?.description ?? "", copyFrom: NO_COPY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role?.id]);

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      if (role) {
        await update.mutateAsync({ roleId: role.id, name: v.name, description: v.description });
        toast.success("Đã cập nhật vai trò");
      } else {
        const id = await create.mutateAsync({
          name: v.name,
          description: v.description,
          copyFromRoleId: v.copyFrom === NO_COPY ? null : v.copyFrom,
        });
        toast.success("Đã tạo vai trò — cấp quyền ở bước tiếp theo");
        onCreated?.(id);
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof OwnerWsRpcError && ["name_taken", "invalid_name"].includes(err.reason)) {
        form.setError("name", { message: err.message });
      } else {
        toast.error(isEdit ? "Chưa cập nhật được" : "Chưa tạo được vai trò", { description: ownerWsErrorMessage(err) });
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Sửa vai trò" : "Tạo vai trò"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Đổi tên và mô tả. Quyền chỉnh ở ma trận bên dưới." : "Đặt tên cho vai trò, rồi cấp quyền ở trang chi tiết."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="owner-role-name">
              Tên vai trò <span className="text-destructive">*</span>
            </Label>
            <Input id="owner-role-name" placeholder="VD: Kế toán thu hồi nợ" autoFocus {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="owner-role-desc">Mô tả</Label>
            <Textarea id="owner-role-desc" rows={2} placeholder="Vai trò này dùng cho…" {...form.register("description")} />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          {!isEdit && copyable.length > 0 && (
            <div className="space-y-1.5">
              <Label>Sao chép quyền từ</Label>
              <Controller
                control={form.control}
                name="copyFrom"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    // Radix bắn "" khi danh sách đổi — bỏ qua (common-pitfalls).
                    onValueChange={(v) => v && field.onChange(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_COPY}>Không — bắt đầu từ trống</SelectItem>
                      {copyable.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Huỷ
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isEdit ? "Lưu" : "Tạo vai trò"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

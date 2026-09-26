import { useEffect, useState } from "react";
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
import { InviteLinkPanel } from "@/components/portal/to-chuc/InviteLinkPanel";
import {
  useCreateOwnerInvite,
  type CreatedOwnerInvite,
  type WorkspaceBranchOption,
} from "@/hooks/useOwnerWorkspaceMembers";
import { OwnerWsRpcError, ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";
import { ownerInviteLink } from "@/lib/ownerWorkspace/inviteLink";
import { INVITABLE_ROLES } from "@/lib/ownerWorkspace/roles";
import { OwnerRoleRadio } from "./OwnerRoleRadio";
import { BranchScopePicker } from "./BranchScopePicker";

const schema = z
  .object({
    email: z.string().trim().min(1, "Nhập email người được mời.").email("Email không hợp lệ."),
    // Trưởng đơn vị không mời thẳng được — trao bằng "Đổi vai trò" sau khi người đó tham gia.
    role: z.enum(["staff", "viewer"]),
    branchScope: z.array(z.string()).nullable(),
  })
  .refine((v) => v.role !== "staff" || v.branchScope === null || v.branchScope.length > 0, {
    path: ["branchScope"],
    message: "Chọn ít nhất một chi nhánh, hoặc chọn “Toàn bộ chi nhánh”.",
  });

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = { email: "", role: "staff", branchScope: null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  branches: WorkspaceBranchOption[];
}

/** Mời thành viên: điền email + vai trò (+ phạm vi) → nhận liên kết để tự gửi đi. */
export function InviteOwnerMemberDialog({ open, onOpenChange, workspaceId, branches }: Props) {
  const create = useCreateOwnerInvite(workspaceId);
  const [created, setCreated] = useState<(CreatedOwnerInvite & { email: string }) | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const role = form.watch("role");

  useEffect(() => {
    if (!open) return;
    form.reset(DEFAULTS);
    setCreated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await create.mutateAsync({
        email: values.email,
        role: values.role,
        branchScope: values.role === "staff" ? values.branchScope : null,
      });
      setCreated({ ...res, email: values.email.trim().toLowerCase() });
    } catch (err) {
      if (err instanceof OwnerWsRpcError && ["already_member", "already_invited", "invalid_email"].includes(err.reason)) {
        form.setError("email", { message: err.message });
      } else if (err instanceof OwnerWsRpcError && err.reason === "invalid_scope") {
        form.setError("branchScope", { message: err.message });
      } else {
        toast.error("Chưa tạo được lời mời", { description: ownerWsErrorMessage(err) });
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Đã tạo lời mời</DialogTitle>
              <DialogDescription>
                Gửi liên kết này cho {created.email} qua kênh nội bộ của đơn vị. Hệ thống chưa gửi email tự
                động. Người nhận phải đăng nhập bằng đúng email này.
              </DialogDescription>
            </DialogHeader>
            <InviteLinkPanel
              token={created.token}
              url={ownerInviteLink(created.token)}
              expiresAt={created.expires_at}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  form.reset(DEFAULTS);
                  setCreated(null);
                }}
              >
                Mời thêm người
              </Button>
              <Button onClick={() => onOpenChange(false)}>Xong</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Mời thành viên</DialogTitle>
              <DialogDescription>
                Liên kết mời có hiệu lực 7 ngày. Muốn thêm Trưởng đơn vị, hãy mời trước rồi đổi vai trò.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="owner-invite-email">Email</Label>
              <Input
                id="owner-invite-email"
                type="email"
                autoComplete="off"
                placeholder="canbo@nganhang.vn"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Vai trò</Label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <OwnerRoleRadio
                    value={field.value}
                    onChange={(r) => field.onChange(r)}
                    roles={INVITABLE_ROLES}
                  />
                )}
              />
            </div>

            {role === "staff" && (
              <div className="space-y-1.5">
                <Label>Phạm vi chi nhánh</Label>
                <Controller
                  control={form.control}
                  name="branchScope"
                  render={({ field }) => (
                    <BranchScopePicker
                      branches={branches}
                      value={field.value}
                      onChange={field.onChange}
                      error={form.formState.errors.branchScope?.message}
                    />
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
                {create.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Tạo liên kết mời
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useState } from "react";
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
import { roleWithinCaller } from "@/lib/ownerWorkspace/roles";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerWsRoles } from "@/hooks/useOwnerWsRoles";
import { OwnerRolePicker } from "../roles/OwnerRolePicker";
import { EXCEEDS_OWN_ROLE_NOTE } from "../roles/roleCopy";
import { BranchScopePicker } from "./BranchScopePicker";

const schema = z
  .object({
    email: z.string().trim().min(1, "Nhập email người được mời.").email("Email không hợp lệ."),
    // Trưởng đơn vị không mời thẳng được — trao bằng "Đổi vai trò" sau khi người đó tham gia.
    roleId: z.string().min(1, "Chọn vai trò."),
    branchScope: z.array(z.string()).nullable(),
  })
  .refine((v) => v.branchScope === null || v.branchScope.length > 0, {
    path: ["branchScope"],
    message: "Chọn ít nhất một chi nhánh, hoặc chọn “Toàn bộ chi nhánh”.",
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { email: "", roleId: "", branchScope: null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  branches: WorkspaceBranchOption[];
}

/** Mời thành viên: điền email + vai trò (+ phạm vi) → nhận liên kết để tự gửi đi. */
export function InviteOwnerMemberDialog({ open, onOpenChange, workspaceId, branches }: Props) {
  const create = useCreateOwnerInvite(workspaceId);
  const { access } = useOwnerWorkspace();
  const { data: allRoles = [] } = useOwnerWsRoles(workspaceId);
  // Trưởng đơn vị không mời thẳng; người mời không phải Trưởng đơn vị chỉ mời vào
  // vai trò nằm trong quyền của mình (server kiểm lại — exceeds_own_permissions).
  const roles = useMemo(() => allRoles.filter((r) => !r.isSystem), [allRoles]);
  const defaults = useMemo<FormValues>(() => {
    const allowed = roles.filter((r) => roleWithinCaller(r, access));
    const preferred = allowed.find((r) => r.code === "STAFF") ?? allowed[0];
    return { ...EMPTY, roleId: preferred?.id ?? "" };
  }, [roles, access]);
  const [created, setCreated] = useState<(CreatedOwnerInvite & { email: string }) | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (!open) return;
    form.reset(defaults);
    setCreated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaults.roleId]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await create.mutateAsync({
        email: values.email,
        roleId: values.roleId,
        branchScope: values.branchScope,
      });
      setCreated({ ...res, email: values.email.trim().toLowerCase() });
    } catch (err) {
      if (err instanceof OwnerWsRpcError && ["already_member", "already_invited", "invalid_email"].includes(err.reason)) {
        form.setError("email", { message: err.message });
      } else if (err instanceof OwnerWsRpcError && ["invalid_scope", "exceeds_own_scope"].includes(err.reason)) {
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
                  form.reset(defaults);
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
              <Label htmlFor="owner-invite-email">
                Email <span className="text-destructive">*</span>
              </Label>
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
              <Label>
                Vai trò <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <OwnerRolePicker
                    value={field.value || null}
                    onChange={field.onChange}
                    roles={roles}
                    lockedReason={(r) => (roleWithinCaller(r, access) ? null : EXCEEDS_OWN_ROLE_NOTE)}
                  />
                )}
              />
              {form.formState.errors.roleId && (
                <p className="text-xs text-destructive">{form.formState.errors.roleId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Phạm vi chi nhánh <span className="text-destructive">*</span>
              </Label>
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

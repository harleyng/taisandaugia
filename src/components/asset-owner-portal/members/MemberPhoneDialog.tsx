import { useEffect, useState } from "react";
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
import { OutcomeFieldError } from "@/components/asset-owner-portal/outcomes/OutcomeFieldError";
import { useSetOwnerMemberPhone, type OwnerWorkspaceMember } from "@/hooks/useOwnerWorkspaceMembers";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";

const PHONE_REGEX = /^0[0-9]{9}$/;

interface Props {
  /** null ⇒ đóng. */
  member: OwnerWorkspaceMember | null;
  onClose: () => void;
  workspaceId: string;
}

/**
 * Bổ sung / sửa SĐT trong hồ sơ của một thành viên khác (thanh-vien:update) — số này hiện ở
 * ô "Người gửi" khi tạo link chia sẻ hồ sơ. Lưu ở trạng thái CHƯA xác thực; chủ tài khoản tự
 * xác thực OTP trong Hồ sơ cá nhân, sau đó người khác không sửa được nữa.
 */
export function MemberPhoneDialog({ member, onClose, workspaceId }: Props) {
  const save = useSetOwnerMemberPhone(workspaceId);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!member) return;
    setPhone(member.phone ?? "");
    setError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.memberId]);

  const name = member?.fullName || member?.email;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    const value = phone.trim();
    if (!PHONE_REGEX.test(value)) {
      setError("Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.");
      return;
    }
    try {
      await save.mutateAsync({ memberId: member.memberId, phone: value });
      toast.success(`Đã cập nhật số điện thoại của ${name}`);
      onClose();
    } catch (err) {
      toast.error("Chưa cập nhật được", { description: ownerWsErrorMessage(err) });
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{member?.phone ? "Sửa số điện thoại" : "Bổ sung số điện thoại"}</DialogTitle>
          <DialogDescription>{member?.fullName ? `${member.fullName} · ${member.email}` : member?.email}</DialogDescription>
        </DialogHeader>

        <form id="member-phone" className="space-y-1.5" onSubmit={(e) => void submit(e)} noValidate>
          <Label htmlFor="member-phone-input">
            Số điện thoại <span className="text-destructive">*</span>
          </Label>
          <Input
            id="member-phone-input"
            inputMode="numeric"
            maxLength={10}
            placeholder="09xxxxxxxx"
            value={phone}
            disabled={save.isPending}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, ""));
              setError(undefined);
            }}
          />
          {error ? (
            <OutcomeFieldError msg={error} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Lưu vào hồ sơ cá nhân của thành viên, hiện ở ô “Người gửi” khi tạo link chia sẻ hồ sơ. Thành viên tự xác
              thực số này trong Hồ sơ cá nhân.
            </p>
          )}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="member-phone" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

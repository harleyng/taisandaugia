import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateGroupFromContacts } from "@/hooks/useOrgContactGroups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  defaultName: string;
  defaultDescription: string;
}

/** "Lưu thành nhóm": chốt danh sách người nhận hiện tại thành một nhóm khách hàng. */
export function SaveAudienceGroupDialog({ open, onOpenChange, contactIds, defaultName, defaultDescription }: Props) {
  const create = useCreateGroupFromContacts();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setDescription(defaultDescription);
  }, [open, defaultName, defaultDescription]);

  const submit = () =>
    create.mutate(
      { name: name.trim(), description: description.trim(), contactIds },
      { onSuccess: () => onOpenChange(false) },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lưu thành nhóm khách hàng</DialogTitle>
          <DialogDescription>
            Nhóm mới gồm {contactIds.length} khách đủ điều kiện gửi. Nhóm là ảnh chụp tại lúc lưu — khách khớp thêm sau
            này không tự vào nhóm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tên nhóm</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={name.trim().length < 2 || !contactIds.length || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu nhóm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

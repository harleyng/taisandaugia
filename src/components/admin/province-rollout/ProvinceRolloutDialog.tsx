import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AdminUnitPicker } from "@/components/shared/AdminUnitPicker";
import { CommuneMultiSelect } from "@/components/admin/province-rollout/CommuneMultiSelect";
import { useProvinceRollout } from "@/hooks/useProvinceRollout";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mở từ một tỉnh đã khởi tạo ⇒ bổ sung xã vào đúng Trạm đó. */
  preset?: { workspaceId: string; provinceCode: string; existing: string[] } | null;
  onDone?: (workspaceId: string) => void;
}

/**
 * "Khởi tạo tỉnh" — tạo (hoặc dùng lại) Trạm cấp tỉnh rồi mở một chi nhánh cho
 * mỗi xã được chọn. Chạy lại với cùng danh sách KHÔNG sinh chi nhánh trùng:
 * server chặn bằng chỉ số `wb_one_per_admin_unit`.
 */
export function ProvinceRolloutDialog({ open, onOpenChange, preset, onDone }: Props) {
  const [province, setProvince] = useState<string | null>(null);
  const [communes, setCommunes] = useState<string[]>([]);
  const rollout = useProvinceRollout();

  useEffect(() => {
    if (!open) return;
    setProvince(preset?.provinceCode ?? null);
    setCommunes([]);
  }, [open, preset?.provinceCode]);

  const submit = async () => {
    if (!province) {
      toast.error("Hãy chọn tỉnh / thành phố.");
      return;
    }
    if (communes.length === 0) {
      toast.error("Hãy chọn ít nhất một xã, phường.");
      return;
    }
    try {
      const res = await rollout.mutateAsync({
        provinceCode: province,
        communeCodes: communes,
        workspaceId: preset?.workspaceId ?? null,
      });
      toast.success(
        `${res.workspace_created ? "Đã tạo" : "Đã cập nhật"} ${res.workspace_name}: thêm ${
          res.branches_created
        } đơn vị, tổng ${res.branches_total}.`,
      );
      onDone?.(res.workspace_id);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không khởi tạo được tỉnh.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-primary" strokeWidth={1.5} />
            {preset ? "Bổ sung đơn vị cho tỉnh" : "Khởi tạo tỉnh"}
          </DialogTitle>
          <DialogDescription>
            Tạo một Trạm cấp tỉnh (cơ quan Nhà nước) và mở một đơn vị cho mỗi xã, phường, đặc khu
            được chọn. Mỗi đơn vị được gắn mã hành chính chính thức — đây là điều kiện để xã lập
            được kế hoạch đấu giá.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rollout-province">
              Tỉnh / thành phố <span className="text-destructive">*</span>
            </Label>
            <AdminUnitPicker
              id="rollout-province"
              level="province"
              value={province}
              onChange={(code) => {
                setProvince(code);
                setCommunes([]);
              }}
              disabled={!!preset || rollout.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Xã / phường / đặc khu <span className="text-destructive">*</span>
            </Label>
            <CommuneMultiSelect
              provinceCode={province}
              value={communes}
              onChange={setCommunes}
              existing={preset ? new Set(preset.existing) : undefined}
              disabled={rollout.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={rollout.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={rollout.isPending}>
            {rollout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {preset ? "Bổ sung đơn vị" : "Khởi tạo tỉnh"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

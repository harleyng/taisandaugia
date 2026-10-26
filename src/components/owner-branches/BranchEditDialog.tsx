import { useState } from "react";
import { Building2, FileText, Loader2, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminUnitPicker } from "@/components/shared/AdminUnitPicker";
import type { BranchPatch, WorkspaceBranch } from "@/hooks/useWorkspaceBranches";

interface BranchEditDialogProps {
  branch: WorkspaceBranch;
  onSave: (patch: BranchPatch) => void;
  onClose: () => void;
  isProcessing: boolean;
}

/**
 * Sửa một chi nhánh / AMC. Tách khỏi `OwnerBranchesPage` khi thêm trường "Đơn vị
 * hành chính" (mỗi hộp thoại một tệp — CLAUDE.md).
 *
 * "Đơn vị hành chính" là mã ĐVHC 2025 (`workspace_branches.admin_unit_code`,
 * xem `src/lib/adminUnits.ts`). Không bắt buộc: ngân hàng / AMC không gắn mã
 * nào; nó có nghĩa khi Trạm là một tỉnh và mỗi chi nhánh là một xã/phường.
 */
export const BranchEditDialog = ({
  branch,
  onSave,
  onClose,
  isProcessing,
}: BranchEditDialogProps) => {
  const [displayName, setDisplayName] = useState(branch.display_name ?? "");
  const [phone, setPhone] = useState(branch.contact_phone ?? "");
  const [email, setEmail] = useState(branch.contact_email ?? "");
  const [notes, setNotes] = useState(branch.notes ?? "");
  const [adminUnitCode, setAdminUnitCode] = useState(branch.admin_unit_code ?? null);

  const handleSave = () => {
    onSave({
      display_name: displayName.trim() || null,
      contact_phone: phone.trim() || null,
      contact_email: email.trim() || null,
      notes: notes.trim() || null,
      admin_unit_code: adminUnitCode,
    });
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa chi nhánh</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {branch.asset_owner_name && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Dữ liệu gốc: <span className="font-medium text-foreground">{branch.asset_owner_name}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Tên hiển thị
            </Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={branch.asset_owner_name ?? "Tên chi nhánh..."}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5" htmlFor="branch-admin-unit">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Đơn vị hành chính
            </Label>
            <AdminUnitPicker
              id="branch-admin-unit"
              value={adminUnitCode}
              onChange={setAdminUnitCode}
            />
            <p className="text-xs text-muted-foreground">
              Xã / phường / đặc khu theo danh mục 2025 — dùng cho kế hoạch đấu giá và tổng hợp
              theo địa bàn.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Số điện thoại
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901 234 567"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="chinhanh@congty.vn"
              type="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Ghi chú
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú nội bộ về chi nhánh này..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Huỷ</Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

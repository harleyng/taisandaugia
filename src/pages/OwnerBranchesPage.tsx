import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, GitBranch, Building2, Phone, Mail, FileText,
  Pencil, Power, PowerOff, ExternalLink, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAssetOwnerWorkspace } from "@/hooks/useAssetOwnerWorkspace";
import {
  useWorkspaceBranches,
  type WorkspaceBranch,
  type BranchPatch,
} from "@/hooks/useWorkspaceBranches";

// ─── Page ────────────────────────────────────────────────────────────────────

const OwnerBranchesPage = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
      setAuthLoading(false);
    });
  }, []);

  const { workspace, wsLoading } = useAssetOwnerWorkspace(userId);
  const { branches, branchesLoading, metrics, syncFromClaims, updateBranch, toggleActive } =
    useWorkspaceBranches(workspace?.id ?? null);

  // Auto-sync on first load if no branches yet
  useEffect(() => {
    if (!workspace?.id || branchesLoading || branches.length > 0) return;
    if (syncFromClaims.isPending) return;
    syncFromClaims.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, branchesLoading, branches.length]);

  const isLoading = authLoading || wsLoading || branchesLoading;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <GitBranch className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">Chưa có workspace</p>
          <p className="text-sm text-muted-foreground">
            Hoàn thành xác thực tổ chức để quản lý chi nhánh và AMC.
          </p>
        </div>
      </div>
    );
  }

  const regularBranches = branches.filter((b) => !b.is_amc);
  const amcBranches = branches.filter((b) => b.is_amc);

  const handleUpdate = (id: string, patch: BranchPatch) => updateBranch.mutate({ id, patch });
  const handleToggle = (branch: WorkspaceBranch) => toggleActive.mutate(branch);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Chi nhánh</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý các đơn vị thành viên và công ty con của <strong>{workspace.primary_name}</strong>.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncFromClaims.mutate()}
          disabled={syncFromClaims.isPending}
          className="gap-2 shrink-0"
        >
          {syncFromClaims.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
          Đồng bộ từ tài sản
        </Button>
      </div>

      <Tabs defaultValue="branches">
        <TabsList className="mb-4">
          <TabsTrigger value="branches" className="gap-2">
            Chi nhánh
            {regularBranches.length > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
                {regularBranches.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="amc" className="gap-2">
            AMC
            {amcBranches.length > 0 && (
              <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-1.5 py-0.5 rounded-full">
                {amcBranches.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branches">
          <BranchTable
            branches={regularBranches}
            metrics={metrics}
            onUpdate={handleUpdate}
            onToggle={handleToggle}
            isProcessing={updateBranch.isPending || toggleActive.isPending}
            emptyLabel="Chưa có chi nhánh nào. Nhấn 'Đồng bộ từ tài sản' để tự động phát hiện."
          />
        </TabsContent>

        <TabsContent value="amc">
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 text-xs text-purple-700">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            AMC không phải chi nhánh — là công ty con đại diện xử lý nợ. Tài sản qua AMC vẫn thuộc tổ chức của bạn.
          </div>
          <BranchTable
            branches={amcBranches}
            metrics={metrics}
            onUpdate={handleUpdate}
            onToggle={handleToggle}
            isProcessing={updateBranch.isPending || toggleActive.isPending}
            emptyLabel="Chưa phát hiện AMC nào. Nhấn 'Đồng bộ từ tài sản' để kiểm tra."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OwnerBranchesPage;

// ─── BranchTable ─────────────────────────────────────────────────────────────

interface BranchTableProps {
  branches: WorkspaceBranch[];
  metrics: Record<string, { total_assets: number; upcoming_auctions: number }>;
  onUpdate: (id: string, patch: BranchPatch) => void;
  onToggle: (branch: WorkspaceBranch) => void;
  isProcessing: boolean;
  emptyLabel: string;
}

const BranchTable = ({ branches, metrics, onUpdate, onToggle, isProcessing, emptyLabel }: BranchTableProps) => {
  const navigate = useNavigate();
  const [editingBranch, setEditingBranch] = useState<WorkspaceBranch | null>(null);

  if (branches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Đơn vị</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Tài sản</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Sắp đấu giá</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Trạng thái</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch, i) => {
                const m = branch.asset_owner_id ? (metrics[branch.asset_owner_id] ?? null) : null;
                const displayName = branch.display_name || branch.asset_owner_name || "—";
                const sourceName = branch.asset_owner_name ?? "";

                return (
                  <tr
                    key={branch.id}
                    className={cn(
                      "transition-colors hover:bg-muted/20",
                      !branch.is_active && "opacity-50",
                      i < branches.length - 1 && "border-b border-border"
                    )}
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground leading-tight truncate">{displayName}</p>
                          {branch.display_name && sourceName && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">{sourceName}</p>
                          )}
                          {(branch.contact_phone || branch.contact_email) && (
                            <div className="flex items-center gap-2 mt-0.5">
                              {branch.contact_phone && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Phone className="h-2.5 w-2.5" /> {branch.contact_phone}
                                </span>
                              )}
                              {branch.contact_email && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Mail className="h-2.5 w-2.5" /> {branch.contact_email}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Total assets */}
                    <td className="px-4 py-3 text-foreground hidden sm:table-cell">
                      {m ? (
                        <span className="font-semibold">{m.total_assets}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Upcoming */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {m && m.upcoming_auctions > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {m.upcoming_auctions} sắp diễn ra
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge
                        variant={branch.is_active ? "default" : "secondary"}
                        className={branch.is_active ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : ""}
                      >
                        {branch.is_active ? "Hoạt động" : "Đã tắt"}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        {/* View assets */}
                        <button
                          onClick={() => {
                            const name = branch.asset_owner_name ?? branch.display_name ?? "";
                            navigate(`/chu-tai-san/tai-san?source=${encodeURIComponent(name)}`);
                          }}
                          title="Xem tài sản"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-muted"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Xem TS</span>
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => setEditingBranch(branch)}
                          title="Chỉnh sửa"
                          className="text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        {/* Toggle active */}
                        <DeactivatePopover
                          branch={branch}
                          onConfirm={() => onToggle(branch)}
                          isProcessing={isProcessing}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit dialog */}
      {editingBranch && (
        <BranchEditDialog
          branch={editingBranch}
          onSave={(patch) => {
            onUpdate(editingBranch.id, patch);
            setEditingBranch(null);
          }}
          onClose={() => setEditingBranch(null)}
          isProcessing={isProcessing}
        />
      )}
    </>
  );
};

// ─── DeactivatePopover ────────────────────────────────────────────────────────

interface DeactivatePopoverProps {
  branch: WorkspaceBranch;
  onConfirm: () => void;
  isProcessing: boolean;
}

const DeactivatePopover = ({ branch, onConfirm, isProcessing }: DeactivatePopoverProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          title={branch.is_active ? "Tắt chi nhánh" : "Kích hoạt"}
          className={cn(
            "text-xs transition-colors px-2 py-1 rounded-lg hover:bg-muted",
            branch.is_active ? "text-muted-foreground hover:text-red-600" : "text-muted-foreground hover:text-green-600"
          )}
        >
          {branch.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 space-y-3" side="left">
        <p className="text-sm font-semibold text-foreground">
          {branch.is_active ? "Tắt chi nhánh này?" : "Kích hoạt lại chi nhánh?"}
        </p>
        <p className="text-xs text-muted-foreground">
          {branch.is_active
            ? "Chi nhánh sẽ không được dùng để khớp tài sản mới. Tài sản hiện tại không bị ảnh hưởng."
            : "Chi nhánh sẽ được đưa vào khớp tài sản trong lần chạy tiếp theo."}
        </p>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
          <Button
            size="sm"
            variant={branch.is_active ? "destructive" : "default"}
            disabled={isProcessing}
            onClick={() => { onConfirm(); setOpen(false); }}
          >
            {branch.is_active ? "Tắt" : "Bật"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ─── BranchEditDialog ─────────────────────────────────────────────────────────

interface BranchEditDialogProps {
  branch: WorkspaceBranch;
  onSave: (patch: BranchPatch) => void;
  onClose: () => void;
  isProcessing: boolean;
}

const BranchEditDialog = ({ branch, onSave, onClose, isProcessing }: BranchEditDialogProps) => {
  const [displayName, setDisplayName] = useState(branch.display_name ?? "");
  const [phone, setPhone] = useState(branch.contact_phone ?? "");
  const [email, setEmail] = useState(branch.contact_email ?? "");
  const [notes, setNotes] = useState(branch.notes ?? "");

  const handleSave = () => {
    onSave({
      display_name: displayName.trim() || null,
      contact_phone: phone.trim() || null,
      contact_email: email.trim() || null,
      notes: notes.trim() || null,
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

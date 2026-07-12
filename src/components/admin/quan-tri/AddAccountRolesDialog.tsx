import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAdminRoles } from "@/hooks/useAdminRoles";
import { useAddAccountRoles } from "@/hooks/useAdminAccounts";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  currentRoleIds: string[];
}

// Dialog "Gán vai trò" — CHỈ thêm (vai trò đã gán hiển thị checked+disabled "Đã gán").
export function AddAccountRolesDialog({ open, onOpenChange, userId, currentRoleIds }: Props) {
  const { data: roles, isLoading } = useAdminRoles();
  const add = useAddAccountRoles();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelected([]);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = roles ?? [];
    if (!q) return list;
    return list.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  }, [roles, search]);

  const toggle = (id: string) => {
    if (currentRoleIds.includes(id)) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    if (selected.length === 0) return;
    try {
      await add.mutateAsync({ userId, roleIds: selected });
      toast.success(`Đã gán ${selected.length} vai trò`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Gán vai trò thất bại", { description: (err as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Gán vai trò</DialogTitle>
          <DialogDescription>Chọn vai trò để gán thêm cho tài khoản. Có thể chọn nhiều vai trò.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm vai trò…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Không tìm thấy vai trò nào.</p>
          ) : (
            filtered.map((r) => {
              const assigned = currentRoleIds.includes(r.id);
              const checked = assigned || selected.includes(r.id);
              return (
                <label
                  key={r.id}
                  className={`flex items-start gap-3 px-3 py-3 transition-colors ${
                    assigned ? "bg-muted/50 opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted/40"
                  }`}
                >
                  <Checkbox checked={checked} disabled={assigned} onCheckedChange={() => toggle(r.id)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{r.name}</span>
                      <Badge variant="secondary" className={r.is_system ? "bg-primary/10 text-primary" : ""}>
                        {r.is_system ? "Hệ thống" : "Tùy chỉnh"}
                      </Badge>
                      {assigned && <Badge variant="secondary" className="bg-success/10 text-success">Đã gán</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                      {r.code}
                      {r.description ? ` • ${r.description}` : ""}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={add.isPending}>Hủy</Button>
          <Button onClick={save} disabled={add.isPending || selected.length === 0}>
            {add.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Gán vai trò{selected.length > 0 ? ` (${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

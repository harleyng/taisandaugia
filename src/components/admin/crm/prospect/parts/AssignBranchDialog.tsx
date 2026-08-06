import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProspectSearch, useSetProspectParent } from "@/hooks/useProspects";
import { prospectSubtypeLabel, type ProspectKind, type ProspectRow } from "@/lib/prospects/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: ProspectKind;
  /** Đơn vị đang xem — sẽ trở thành công ty mẹ. */
  parentId: string;
  parentName: string;
  /** Id các đơn vị đã trực thuộc, để không chào lại. */
  existingIds: string[];
}

export function AssignBranchDialog({
  open, onOpenChange, kind, parentId, parentName, existingIds,
}: Props) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<ProspectRow | null>(null);
  const { data: results, isFetching } = useProspectSearch(kind, search, open);
  const setParent = useSetProspectParent();

  const candidates = (results ?? []).filter(
    (r) => r.id !== parentId && !existingIds.includes(r.id),
  );

  const close = () => {
    setSearch("");
    setPicked(null);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!picked) return;
    try {
      await setParent.mutateAsync({ kind, childIds: [picked.id], parentId });
      toast.success(`Đã gán "${picked.name}" làm đơn vị thành viên`);
      close();
    } catch {
      toast.error("Gán thất bại — kiểm tra lại quan hệ giữa hai đơn vị");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm đơn vị thành viên</DialogTitle>
          <DialogDescription>
            Chọn một pháp nhân trên sàn để gán làm chi nhánh / AMC của &quot;{parentName}&quot;.
            Quan hệ bạn gán ở đây được ghi nhận là đã xác nhận và sẽ không bị hệ thống suy
            luận lại đè lên.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPicked(null); }}
              placeholder="Nhập ít nhất 2 ký tự tên đơn vị…"
              className="pl-9"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {search.trim().length < 2 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nhập tên đơn vị để tìm.
              </p>
            ) : isFetching ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : candidates.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Không tìm thấy đơn vị phù hợp.
              </p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPicked(c)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    picked?.id === c.id ? "bg-primary/10" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground">{c.name}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {prospectSubtypeLabel(c.subtype)}
                    {c.top_province ? ` · ${c.top_province}` : ""}
                    {` · ${c.total_listings} tài sản`}
                  </span>
                  {/* Đơn vị đã có mẹ khác: gán tiếp sẽ chuyển nó sang đây. */}
                  {c.parent_id && c.parent_id !== parentId && (
                    <Badge variant="outline" className="mt-1.5">
                      Đang thuộc {c.parent_name ?? "đơn vị khác"}
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>Hủy</Button>
          <Button disabled={!picked || setParent.isPending} onClick={handleSubmit}>
            {setParent.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Gán làm đơn vị thành viên
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

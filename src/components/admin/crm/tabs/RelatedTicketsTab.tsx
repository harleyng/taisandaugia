import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRelatedTickets, useDeleteTicket, useSetTicketStatus } from "@/hooks/useTickets";
import { TicketListView } from "@/components/admin/tickets/list/TicketListView";
import { TicketFormDialog } from "@/components/admin/tickets/TicketFormDialog";
import type { CrmRelation } from "@/lib/crm/relation";
import type { Ticket, TicketStatus } from "@/types/tickets";

/** Tab "Tickets" nhúng trong trang chi tiết một đối tượng CRM. */
export function RelatedTicketsTab({ relation }: { relation: Partial<CrmRelation> }) {
  const { data: tickets, isLoading } = useRelatedTickets(relation);
  const del = useDeleteTicket();
  const setStatus = useSetTicketStatus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);

  const openCreate = () => { setEditing(null); setDialogOpen(true); };

  const actions = {
    onEdit: (t: Ticket) => { setEditing(t); setDialogOpen(true); },
    onDelete: setDeleteTarget,
    onSetStatus: (t: Ticket, status: TicketStatus) => setStatus.mutate({ id: t.id, status }),
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa ticket");
    } catch {
      toast.error("Xóa thất bại");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm ticket
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : (tickets ?? []).length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">Chưa có ticket nào cho khách hàng này.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo ticket đầu tiên
          </Button>
        </div>
      ) : (
        <TicketListView tickets={tickets ?? []} actions={actions} hideRelation pageSize={5} />
      )}

      <TicketFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        defaultRelation={relation}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Ticket &quot;{deleteTarget?.subject}&quot; sẽ bị xóa. Bản ghi liên hệ gốc từ website vẫn được giữ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

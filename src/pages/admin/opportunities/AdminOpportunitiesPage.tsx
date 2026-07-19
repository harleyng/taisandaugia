import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useOpportunities,
  useMoveOpportunityStage,
  opportunityErrorMessage,
} from "@/hooks/useOpportunities";
import { OpportunityBoard } from "@/components/admin/opportunities/OpportunityBoard";
import { OpportunityFormDialog } from "@/components/admin/opportunities/OpportunityFormDialog";
import { WinOpportunityDialog } from "@/components/admin/opportunities/WinOpportunityDialog";
import { LostOpportunityDialog } from "@/components/admin/opportunities/LostOpportunityDialog";
import { formatVnd } from "@/lib/advertising/slug";
import { isOverdue } from "@/lib/opportunities/opportunityStage";
import type { Opportunity, OpportunityStage } from "@/types/opportunities";

export default function AdminOpportunitiesPage() {
  const { data: opportunities, isLoading } = useOpportunities();
  const move = useMoveOpportunityStage();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [winTarget, setWinTarget] = useState<Opportunity | null>(null);
  const [lostTarget, setLostTarget] = useState<{ o: Opportunity; stage: "lost" | "rejected" } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return opportunities ?? [];
    return (opportunities ?? []).filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.code ?? "").toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q) ||
        (o.lead?.name ?? "").toLowerCase().includes(q),
    );
  }, [opportunities, search]);

  const stats = useMemo(() => {
    const all = opportunities ?? [];
    const open = all.filter((o) => o.stage === "selling" || o.stage === "pending_approval");
    return {
      total: all.length,
      openValue: open.reduce((s, o) => s + Number(o.amount ?? 0), 0),
      overdue: open.filter((o) => isOverdue(o.stage, o.expected_close_at)).length,
    };
  }, [opportunities]);

  const openEdit = (o: Opportunity) => { setEditing(o); setFormOpen(true); };

  const handleMove = async (o: Opportunity, stage: Exclude<OpportunityStage, "won">) => {
    try {
      await move.mutateAsync({ id: o.id, stage });
    } catch (err) {
      toast.error(opportunityErrorMessage(err) ?? "Đổi giai đoạn thất bại");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cơ hội</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total} cơ hội · đang mở {formatVnd(stats.openValue)}
            {stats.overdue > 0 && (
              <span className="text-destructive"> · {stats.overdue} quá hạn</span>
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo cơ hội
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo tên cơ hội, mã, khách hàng…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[420px] w-[260px] shrink-0 rounded-xl" />
          ))}
        </div>
      ) : (
        <OpportunityBoard
          opportunities={filtered}
          onOpen={openEdit}
          onMove={handleMove}
          onRequestWin={setWinTarget}
          onRequestLost={(o, stage) => setLostTarget({ o, stage })}
        />
      )}

      <OpportunityFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      {/* Huỷ dialog ⇒ thẻ về cột cũ: cache chưa đổi nên chỉ cần đóng. */}
      <WinOpportunityDialog opportunity={winTarget} onOpenChange={() => setWinTarget(null)} />

      <LostOpportunityDialog
        opportunity={lostTarget?.o ?? null}
        stage={lostTarget?.stage ?? "lost"}
        onOpenChange={() => setLostTarget(null)}
      />
    </div>
  );
}

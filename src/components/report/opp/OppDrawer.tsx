import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { type SessionRow } from "@/lib/mockOppReport";

const typeBadge: Record<string, string> = {
  bds: "bg-primary/10 text-primary",
  oto: "bg-amber-100 text-amber-700",
  tsc: "bg-blue-100 text-blue-700",
  mm: "bg-blue-100 text-blue-700",
};

const legalBadge: Record<string, string> = {
  tha: "bg-orange-100 text-orange-700",
  npl: "bg-red-100 text-red-700",
  thuong: "bg-blue-100 text-blue-700",
  tl: "bg-amber-100 text-amber-700",
};

const KV = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between py-2 border-b border-border text-sm last:border-b-0">
    <span className="text-muted-foreground">{k}</span>
    <span className="font-mono font-semibold text-right max-w-[60%]">{v}</span>
  </div>
);

interface OppDrawerProps {
  session: SessionRow | null;
  open: boolean;
  onClose: () => void;
}

export const OppDrawer = ({ session, open, onClose }: OppDrawerProps) => {
  if (!session) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:w-[460px] p-0 flex flex-col gap-0">
        {/* Head */}
        <div className="px-5 py-4 border-b border-border">
          <SheetHeader>
            <h3 className="font-serif font-semibold text-base leading-tight pr-6">{session.title}</h3>
          </SheetHeader>
          <div className="flex gap-1.5 mt-2.5 flex-wrap">
            <span className={cn("text-[10px] font-mono font-semibold px-2 py-0.5 rounded", typeBadge[session.typeId])}>
              {session.type}
            </span>
            <span className={cn("text-[10px] font-mono font-semibold px-2 py-0.5 rounded", legalBadge[session.legalId])}>
              {session.legal}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Thông tin phiên</p>
            <div className="divide-y divide-border">
              <KV k="Vị trí" v={session.loc} />
              <KV k="Diện tích" v={session.area} />
              <KV k="Giá khởi điểm" v={session.price} />
              <KV k="Chủ tài sản" v={session.owner} />
              <KV k="Tổ chức đấu giá" v={session.auctioneer} />
              <KV k="Ngày tổ chức" v={`${session.date} · còn ${session.daysLeft} ngày`} />
            </div>
          </div>

          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">So sánh với khu vực</p>
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-muted-foreground leading-relaxed">
              Giá khởi điểm của phiên này nằm trong{" "}
              <strong className="text-primary">top 20%</strong> nguồn cung khớp tiêu chí — cao hơn trung vị 12%.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button
            onClick={onClose}
            className="flex-shrink-0 px-4 py-2.5 text-sm font-semibold rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
          >
            Đóng
          </button>
          <button className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
            Xem thông báo gốc →
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

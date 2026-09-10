import { useMemo, useState } from "react";
import { Loader2, SearchX, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMatchedOrgs } from "@/hooks/useAssetPosting";
import { postingToMatchCriteria } from "@/components/asset-posting/wizardSchema";
import type { AssetPosting } from "@/types/asset-posting";

interface DispatchOrgsDialogProps {
  posting: AssetPosting;
  /** Tổ chức đã gửi rồi — hiện mờ, không cho chọn lại. */
  alreadySentIds: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDispatch: (orgs: { org_id: string; score: number | null }[], message: string) => void;
  isPending: boolean;
}

/**
 * Chọn nhiều tổ chức để gửi hồ sơ.
 *
 * Danh sách CHỈ gồm tổ chức đã có tài khoản trên sàn (useMatchedOrgs mặc định
 * lọc vậy) — gửi cho tổ chức không có tài khoản thì không ai trả lời được.
 *
 * ⚠️ Điểm khớp % đến từ orgMatching.ts và hiện vẫn là số SUY RA từ băm org.id,
 * không phải năng lực thật. Dùng như gợi ý sắp xếp, đừng coi là bằng chứng.
 */
export function DispatchOrgsDialog({
  posting, alreadySentIds, open, onOpenChange, onDispatch, isPending,
}: DispatchOrgsDialogProps) {
  const criteria = useMemo(() => postingToMatchCriteria(posting), [posting]);
  const { results, isLoading } = useMatchedOrgs(criteria);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? results.filter((r) => r.org.name.toLowerCase().includes(q)) : results;
  }, [results, search]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    const orgs = results
      .filter((r) => picked.has(r.org.id))
      .map((r) => ({ org_id: r.org.id, score: r.score }));
    onDispatch(orgs, message);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gửi hồ sơ cho tổ chức đấu giá</DialogTitle>
          <DialogDescription>
            Chọn các tổ chức phù hợp. Mỗi tổ chức sẽ nhận hồ sơ trong cổng của họ và gửi báo giá lại cho chủ tài sản.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Tìm tổ chức theo tên…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <SearchX className="h-7 w-7 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">
                Không có tổ chức nào đã đăng ký tài khoản khớp tiêu chí này. Chỉ tổ chức có tài khoản mới nhận và trả
                lời được yêu cầu.
              </p>
            </div>
          ) : (
            <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
              {visible.map((r) => {
                const sent = alreadySentIds.has(r.org.id);
                const meta = [r.org.province, `${r.attrs.successful_sessions} phiên`, `thù lao ~${r.attrs.commission_rate}%`]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <label
                    key={r.org.id}
                    className={`flex items-start gap-3 rounded-xl border p-3 ${
                      sent ? "cursor-not-allowed border-border opacity-55" : "cursor-pointer border-border hover:border-primary/40"
                    }`}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={picked.has(r.org.id)}
                      disabled={sent}
                      onCheckedChange={() => toggle(r.org.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="truncate">{r.org.name}</span>
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                          {Math.round(r.score)}%
                        </span>
                        {sent && <span className="shrink-0 text-[11px] text-muted-foreground">đã gửi</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{meta}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="dispatch-message">Lời nhắn gửi kèm (tuỳ chọn)</Label>
            <Textarea
              id="dispatch-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ghi chú của sàn về tài sản này…"
              className="min-h-[64px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={isPending || picked.size === 0} className="gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Gửi {picked.size > 0 ? `${picked.size} tổ chức` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

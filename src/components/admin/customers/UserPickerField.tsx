import { useEffect, useState } from "react";
import { Loader2, Search, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfileBrief, useProfileSearch } from "@/hooks/useProfiles";

interface Props {
  /** id tài khoản đang gắn, null nếu chưa gắn. */
  value: string | null;
  onChange: (userId: string | null) => void;
}

/** Ô chọn "Tài khoản trên sàn" cho một khách hàng CRM.
 *
 *  Đây là cầu nối duy nhất tới email marketing (campaign_recipients.user_id) và
 *  tới đơn nạp credit (orders.user_id) — nên cần gắn tay được, không chỉ trông
 *  vào khớp email tự động lúc chuyển đổi lead. */
export function UserPickerField({ value, onChange }: Props) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  // Chống gọi mỗi ký tự — 300ms là đủ để gõ xong một từ.
  useEffect(() => {
    const t = setTimeout(() => setTerm(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: linked, isLoading: loadingLinked } = useProfileBrief(value);
  const { data: results, isFetching } = useProfileSearch(term, open);

  if (value) {
    return (
      <div className="space-y-1.5">
        <Label>Tài khoản trên sàn</Label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-sm">
            {loadingLinked ? (
              <span className="text-muted-foreground">Đang tải…</span>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {linked?.name || "Không tên"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {linked?.email ?? value}
                </span>
              </>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="Gỡ tài khoản"
            onClick={() => { onChange(null); setQ(""); setTerm(""); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Tài khoản trên sàn</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          placeholder="Tìm theo tên hoặc email…"
          className="pl-8"
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {term.length >= 2 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
          {!results || results.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">
              {isFetching ? "Đang tìm…" : "Không tìm thấy tài khoản nào"}
            </p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setQ(""); setTerm(""); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 text-sm text-foreground truncate">
                  {p.name || "Không tên"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground truncate max-w-[45%]">
                  {p.email}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Gắn tài khoản để xem chiến dịch email marketing và đơn nạp credit của khách hàng này.
      </p>
    </div>
  );
}

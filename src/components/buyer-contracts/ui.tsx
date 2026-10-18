import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, CircleCheck, CircleX, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tag, Tone } from "@/lib/biddingContracts/buyerContract";

// Mảnh giao diện dùng chung của các màn hồ sơ phía người mua (design "San - Ho So
// Tham Gia" 979d4c55: .badge, .opt, .ck, .cp, .crumb). Thẻ mục / hộp kv / nút lấy
// từ components/auction-sessions/detail/ui.tsx để cùng một bộ với trang phiên.

const TONE: Record<Tone, string> = {
  ok: "bg-success/10 text-success",
  amber: "bg-accent/20 text-[hsl(var(--tier-warn-fg))]",
  muted: "bg-muted text-muted-foreground",
  red: "bg-destructive text-destructive-foreground",
  live: "bg-destructive/10 text-destructive",
  pri: "bg-primary/10 text-primary",
};

export function TagPill({ tag, className }: { tag: Tag; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold",
        TONE[tag.tone],
        className,
      )}
    >
      {tag.label}
    </span>
  );
}

/** Đường dẫn vụn: mục cuối là trang hiện tại. */
export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground" aria-label="Đường dẫn">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${it.label}-${i}`} className="flex items-center gap-1.5">
            {it.to && !last ? (
              <Link to={it.to} className="max-w-[260px] truncate hover:text-foreground">
                {it.label}
              </Link>
            ) : (
              <span className={cn("max-w-[260px] truncate", last && "font-medium text-foreground")}>{it.label}</span>
            )}
            {!last && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
          </span>
        );
      })}
    </nav>
  );
}

/** Ô lựa chọn lớn (design `.opt`) — nhóm radio. */
export function OptionTile({
  selected,
  title,
  hint,
  onSelect,
  disabled,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-1 rounded-xl px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "bg-primary/[.06] ring-2 ring-inset ring-primary" : "bg-muted hover:bg-muted/70",
      )}
    >
      <b className="text-[15px] font-semibold text-foreground">{title}</b>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

/** Dòng chọn có ô tick (design `.ck`) — chọn lô, đồng ý điều khoản. */
export function CheckRow({
  checked,
  onToggle,
  children,
  aside,
  disabled,
  radio,
}: {
  checked: boolean;
  onToggle?: () => void;
  children: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
  radio?: boolean;
}) {
  return (
    <button
      type="button"
      role={radio ? "radio" : "checkbox"}
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed",
        checked ? "bg-primary/[.06] ring-[1.5px] ring-inset ring-primary" : "bg-muted hover:bg-muted/70",
      )}
    >
      {radio ? (
        <span
          className={cn(
            "h-5 w-5 shrink-0 rounded-full bg-card",
            checked ? "shadow-[inset_0_0_0_6px_hsl(var(--primary))]" : "shadow-[inset_0_0_0_1.5px_hsl(var(--border))]",
          )}
        />
      ) : (
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
            checked ? "bg-primary" : "bg-card shadow-[inset_0_0_0_1.5px_hsl(var(--muted-foreground)/.5)]",
          )}
        >
          {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
        </span>
      )}
      <span className="min-w-0 flex-1 text-foreground">{children}</span>
      {aside && <span className="shrink-0 text-right">{aside}</span>}
    </button>
  );
}

/** Nút "Sao chép" nhỏ nền xanh nhạt (design `.cpb`). */
export function CopyButton({ value, label = "Sao chép" }: { value: string; label?: string }) {
  const copy = () => {
    void navigator.clipboard?.writeText(value).catch((): null => null);
    toast.success("Đã sao chép");
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-xs font-semibold text-primary hover:bg-primary/15"
    >
      <Copy className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/** Một dòng thông tin chuyển khoản (design `.cp`). */
export function CopyRow({ label, value, copy, big }: { label: string; value: ReactNode; copy?: string; big?: boolean }) {
  return (
    <div className="border-b border-border py-2.5 first:pt-0 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center justify-between gap-3">
        <b className={cn("break-words font-semibold text-foreground", big && "text-lg text-primary")}>{value}</b>
        {copy && <CopyButton value={copy} />}
      </div>
    </div>
  );
}

/** Danh sách có dấu tick / dấu chéo (design `.chk`). */
export function CheckList({ items }: { items: { ok?: boolean; children: ReactNode }[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
          {it.ok === false ? (
            <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          ) : (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          )}
          <span>{it.children}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tệp đính kèm một dòng (design `.doc`). */
export function DocLine({ ext, title, sub, aside }: { ext: string; title: string; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-[10px] font-semibold text-muted-foreground">
        {ext}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground">{title}</div>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      {aside}
    </div>
  );
}

/** Lưới nhãn–giá trị 2 cột tự co (design `.dl2`). */
export function InfoGrid({ rows }: { rows: { label: string; value: ReactNode; full?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className={cn("min-w-0", r.full && "col-span-full")}>
          <dt className="text-xs text-muted-foreground">{r.label}</dt>
          <dd className="font-medium text-foreground">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

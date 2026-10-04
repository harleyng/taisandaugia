import { ExternalLink, Image as ImageIcon, Mail, Rocket, Share2, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { cn } from "@/lib/utils";
import type { Deliverable, DeliverableKind } from "@/lib/ownerMarketing/orderReport";
import { formatShortDate } from "../format";

const ICONS: Record<DeliverableKind, LucideIcon> = {
  banner: ImageIcon,
  email: Mail,
  featured: Rocket,
  post: Share2,
};

const STATE: Record<Deliverable["state"], { label: string; className: string }> = {
  running: { label: "Đang chạy", className: "bg-primary/10 text-primary" },
  done: { label: "Đã xong", className: "bg-success/10 text-success" },
  pending: { label: "Đang chuẩn bị", className: "bg-muted text-muted-foreground" },
};

/** "Gửi 23/09 · Tệp …" cho email; "Trang chủ, vị trí 1 · 21/09 – 04/10" cho các kênh còn lại. */
function subLine(d: Deliverable): string | null {
  if (d.kind === "email") return [d.from ? `Gửi ${formatShortDate(d.from)}` : null, d.detail].filter(Boolean).join(" · ") || null;
  const when = d.from || d.to ? `${formatShortDate(d.from)} – ${formatShortDate(d.to)}` : null;
  return [d.detail, when].filter(Boolean).join(" · ") || null;
}

function Row({ d }: { d: Deliverable }) {
  const Icon = ICONS[d.kind];
  const sub = subLine(d);
  const right = "col-start-2 mt-2 md:col-start-3 md:row-span-2 md:row-start-1 md:mt-0 md:self-center";
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-x-3.5 gap-y-1 border-t border-border py-3.5 first:border-t-0 first:pt-0.5 md:grid-cols-[36px_minmax(0,1fr)_auto]">
      <span className="row-span-2 grid h-9 w-9 place-items-center rounded-[10px] bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-foreground">
        {d.title}
        <span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", STATE[d.state].className)}>
          {STATE[d.state].label}
        </span>
      </div>
      <div className="col-start-2 text-[13px] text-muted-foreground">
        {sub}
        {d.url && (
          <a
            href={d.url}
            target="_blank"
            rel="noreferrer noopener"
            className={cn("inline-flex items-center gap-1 font-semibold text-primary hover:underline", sub && "ml-2")}
          >
            Xem bài đăng
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
      {d.figures.length > 0 ? (
        <dl className={cn("flex gap-[22px] tabular-nums", right)}>
          {d.figures.map((f) => (
            <div key={f.label} className="min-w-[64px] md:text-right">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="whitespace-nowrap text-[17px] font-bold text-foreground">
                {f.value}
                {f.hint && <em className="ml-1 text-xs font-medium not-italic text-muted-foreground">{f.hint}</em>}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        d.emptyText && <p className={cn("text-[13px] text-muted-foreground", right)}>{d.emptyText}</p>
      )}
    </li>
  );
}

interface OrderDeliverablesProps {
  items: Deliverable[];
  isLoading: boolean;
}

/** "Sàn đã thực hiện": mỗi hạng mục một dòng — kênh, thời gian, số liệu của chính kênh đó. */
export function OrderDeliverables({ items, isLoading }: OrderDeliverablesProps) {
  return (
    <SectionCard
      title="Sàn đã thực hiện"
      actions={!isLoading && <span className="text-[13px] text-muted-foreground">{items.length} hạng mục</span>}
    >
      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : items.length > 0 ? (
        <ul>
          {items.map((d) => (
            <Row key={d.kind} d={d} />
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-muted-foreground">Sàn chưa gắn hạng mục nào cho đơn này.</p>
      )}
    </SectionCard>
  );
}

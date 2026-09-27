import { useEffect, useState, type ReactNode } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { signContractFile } from "@/hooks/useConsignmentContract";

export interface ContractDoc {
  key: string;
  name: string;
  sub: string;
  /** null ⇒ chưa có (hiện mờ, viền nét đứt). */
  action: ReactNode | null;
}

const LINK = "inline-flex items-center gap-1.5 py-1 text-[13px] font-semibold text-primary hover:text-primary/80";

/** "Tải" tệp trong bucket PRIVATE — ký URL trước khi render (window.open sau await bị chặn như popup). */
export function StorageDocLink({ path, bucket }: { path: string; bucket?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    void signContractFile(path, bucket).then((u) => {
      if (!alive) return;
      setUrl(u);
      setFailed(!u);
    });
    return () => {
      alive = false;
    };
  }, [path, bucket]);
  if (failed) return <span className="text-xs text-muted-foreground">Không mở được</span>;
  if (!url) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Đang chuẩn bị tệp" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={LINK}>
      <Download className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
      Tải
    </a>
  );
}

/** "Tải" cho tệp dựng tại chỗ (PDF hợp đồng dịch vụ). */
export function ActionDocLink({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button type="button" className={LINK} onClick={onClick} disabled={busy}>
      {busy ? (
        <Loader2 className="h-[15px] w-[15px] animate-spin" aria-hidden />
      ) : (
        <Download className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
      )}
      Tải
    </button>
  );
}

/** Thẻ "Tài liệu": "2/3 có sẵn"; tài liệu chưa có hiện mờ kèm lý do. */
export function ContractDocumentsCard({ docs }: { docs: ContractDoc[] }) {
  const ready = docs.filter((d) => d.action).length;
  return (
    <section className="rounded-2xl bg-card shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-[22px] pb-1 pt-5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Tài liệu</h2>
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {ready}/{docs.length} có sẵn
        </span>
      </div>
      <ul className="px-[22px] pb-3 pt-2">
        {docs.map((d, i) => (
          <li key={d.key} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-[13px]", i > 0 && "border-t")}>
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "grid h-8 w-8 flex-none place-items-center rounded-lg text-muted-foreground",
                  d.action ? "bg-muted" : "border border-dashed",
                )}
              >
                <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0">
                <b className={cn("block text-[13.5px]", d.action ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                  {d.name}
                </b>
                <small className="mt-px block text-[12.5px] text-muted-foreground">{d.sub}</small>
              </div>
            </div>
            <div>{d.action}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

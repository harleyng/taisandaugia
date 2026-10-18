import { ExternalLink } from "lucide-react";
import { useKycImageUrl } from "@/hooks/useKycProfile";
import type { ContractDocument } from "@/lib/biddingContracts/contractDetail";
import { cn } from "@/lib/utils";
import { HsCard } from "./ui";

const STRIPES =
  "bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_6px,hsl(var(--border))_6px_12px)]";

function DocTile({ doc, showFile }: { doc: ContractDocument; showFile: boolean }) {
  const { data: url, isError } = useKycImageUrl(showFile ? doc.path : null);
  const placeholder = !showFile ? "đã ẩn" : isError ? "không xem được" : doc.isImage ? "ảnh giấy tờ" : "tài liệu";
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[10px]",
        doc.flag
          ? "shadow-[inset_0_0_0_1.5px_hsl(var(--warning))]"
          : "shadow-[inset_0_0_0_1px_hsl(var(--border))]",
      )}
    >
      <div className={cn("grid aspect-video place-items-center", !(url && doc.isImage) && STRIPES)}>
        {url && doc.isImage ? (
          <img src={url} alt={doc.label} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-muted-foreground">
            {placeholder}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-px px-[11px] pb-2 pt-[9px]">
        <b className="text-[12.5px] font-semibold leading-snug">{doc.label}</b>
        <small className="text-[11.5px] text-muted-foreground">
          {doc.flag ? <em className="font-semibold not-italic text-[hsl(var(--tier-warn-strong))]">{doc.flag}</em> : doc.meta}
        </small>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center gap-[5px] self-start py-1 text-[12.5px] font-semibold text-primary hover:text-primary/80"
          >
            <ExternalLink className="h-[15px] w-[15px]" />
            Xem bản gốc
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Thẻ "Giấy tờ" (design `docH`). Ảnh nằm trong bucket private buyer-kyc; tổ chức chỉ
 * đọc được khi hồ sơ còn 'paid' (can_read_buyer_kyc_object) — hồ sơ bị từ chối thì ẩn.
 */
export function DocumentsCard({ docs, showFiles }: { docs: ContractDocument[]; showFiles: boolean }) {
  return (
    <HsCard title="Giấy tờ" aside={`${docs.length} tệp`}>
      {docs.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Hồ sơ không có giấy tờ đính kèm.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2.5">
          {docs.map((d) => (
            <DocTile key={d.key} doc={d} showFile={showFiles} />
          ))}
        </div>
      )}
      {!showFiles && docs.length > 0 && (
        <p className="mt-3 text-[12.5px] text-muted-foreground">Ảnh giấy tờ không còn hiển thị sau khi hồ sơ bị từ chối.</p>
      )}
    </HsCard>
  );
}

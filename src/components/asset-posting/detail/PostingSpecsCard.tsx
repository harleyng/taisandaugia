import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { renderDeltaValue } from "../format";
import type { AssetPosting } from "@/types/asset-posting";

/** "Mô tả & thông số": mô tả tự do + lưới thông số riêng của loại tài sản. */
export function PostingSpecsCard({ posting: p }: { posting: AssetPosting }) {
  const descriptors = getDeltaFields(p.child_slug);
  const description = p.description?.trim();

  return (
    <SectionCard title="Mô tả & thông số">
      {description && (
        <p className="max-w-[68ch] whitespace-pre-line text-sm leading-relaxed text-foreground [text-wrap:pretty]">
          {description}
        </p>
      )}
      {description && descriptors.length > 0 && <div className="!my-[18px] h-px bg-border" />}
      {descriptors.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
          {descriptors.map((d) => (
            <div key={d.key} className="min-w-0">
              <dt className="text-[12.5px] text-muted-foreground">{d.label}</dt>
              <dd className="mt-px break-words text-sm font-semibold text-foreground">
                {renderDeltaValue(d, p.delta_fields?.[d.key])}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        !description && <p className="text-sm text-muted-foreground">Chưa có mô tả hay thông số.</p>
      )}
    </SectionCard>
  );
}

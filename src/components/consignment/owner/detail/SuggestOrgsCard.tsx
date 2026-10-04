import { useMemo, useState } from "react";
import { Check, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_RFQ_ORGS } from "@/constants/asset-posting-rules";
import { buildAssetBrief } from "@/lib/assetBrief";
import { orgFitShort } from "@/lib/orgFit";
import { orgSubLine } from "@/lib/consignment/ownerConsignmentView";
import { useMatchedOrgs, useSendServiceRequests } from "@/hooks/useAssetPosting";
import { trackRecordLabel, useOrgTrackRecords } from "@/hooks/useConsignmentOwnerView";
import { postingToBriefInput, postingToMatchCriteria } from "@/components/asset-posting/wizardSchema";
import type { AssetPosting } from "@/types/asset-posting";
import { KgCard, KgOrg, KgSubLabel } from "./KgCard";
import { FindOrgsDialog } from "./FindOrgsDialog";
import { BrokerRequestDialog } from "./BrokerRequestDialog";

/** Số tổ chức gợi ý hiện sẵn — muốn xem hết thì "Tìm tổ chức khác". */
const SUGGEST_COUNT = 3;

interface SuggestOrgsCardProps {
  posting: AssetPosting;
  /** Tổ chức đã nhận hồ sơ (mọi trạng thái) — không gửi lại được. */
  sentOrgIds: Set<string>;
  /** Tổ chức đang giữ hồ sơ — áp trần MAX_RFQ_ORGS. */
  activeCount: number;
  /** Cho nhờ sàn: mọi lúc, trừ khi hồ sơ đã có yêu cầu nhờ sàn chưa huỷ (idx_abr_one_open). */
  allowBroker: boolean;
}

/**
 * Gửi hồ sơ cho tổ chức: vài gợi ý hàng đầu chọn được ngay, lối "Tìm tổ chức khác"
 * mở danh sách đầy đủ, và lối "Nhờ sàn chọn giúp". Bản mô tả gửi kèm là bản sàn soạn
 * sẵn từ hồ sơ — giống hệt khi gửi từ wizard mà không sửa.
 */
export function SuggestOrgsCard({ posting, sentOrgIds, activeCount, allowBroker }: SuggestOrgsCardProps) {
  const criteria = useMemo(() => postingToMatchCriteria(posting), [posting]);
  const { results, isLoading } = useMatchedOrgs(criteria);
  const send = useSendServiceRequests();
  const [picked, setPicked] = useState<string[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [brokering, setBrokering] = useState(false);

  const left = Math.max(0, MAX_RFQ_ORGS - activeCount);
  const suggestions = results.filter((r) => !sentOrgIds.has(r.org.id)).slice(0, SUGGEST_COUNT);
  const { data: records } = useOrgTrackRecords(suggestions.map((r) => r.org.id));
  // Chưa chạm vào: chọn sẵn gợi ý đầu tiên (như thiết kế).
  const pick = picked ?? (suggestions[0] && left > 0 ? [suggestions[0].org.id] : []);

  const toggle = (id: string) =>
    setPicked(pick.includes(id) ? pick.filter((x) => x !== id) : pick.length < left ? [...pick, id] : pick);

  const submit = () => {
    const chosen = suggestions.filter((r) => pick.includes(r.org.id));
    if (!chosen.length) return;
    send.mutate(
      {
        postingId: posting.id,
        orgs: chosen.map((r) => ({ orgId: r.org.id, matchScore: r.score })),
        message: buildAssetBrief(postingToBriefInput(posting)),
      },
      { onSuccess: () => setPicked(null) },
    );
  };

  return (
    <KgCard title={sentOrgIds.size ? "Gửi thêm tổ chức" : "Chọn tổ chức nhận hồ sơ"} aux={`Còn ${left} suất gửi`}>
      <KgSubLabel>Gợi ý theo loại tài sản & khu vực</KgSubLabel>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : suggestions.length === 0 ? (
        <p className="rounded-[10px] bg-muted/40 px-3.5 py-3 text-[13px] text-muted-foreground">
          Không còn tổ chức gợi ý phù hợp — tìm trong danh sách đầy đủ hoặc nhờ sàn chọn giúp.
        </p>
      ) : (
        <div className="flex flex-col gap-2" role="group" aria-label="Tổ chức gợi ý">
          {suggestions.map((r, i) => {
            const on = pick.includes(r.org.id);
            const why = orgFitShort(r, criteria);
            return (
              <button
                key={r.org.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={!on && pick.length >= left}
                onClick={() => toggle(r.org.id)}
                className={cn(
                  "grid grid-cols-[20px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1 rounded-[10px] border bg-card px-3.5 py-[11px] text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 sm:grid-cols-[20px_minmax(0,1.1fr)_minmax(0,1fr)_auto]",
                  on ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-input",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-[18px] w-[18px] place-items-center rounded-[5px] border-[1.5px] text-primary-foreground",
                    on ? "border-primary bg-primary" : "border-input bg-card",
                  )}
                >
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <KgOrg name={r.org.name} logoUrl={r.org.logo_url} sub={orgSubLine(r.org.province, trackRecordLabel(records?.get(r.org.id)))} />
                {why && <span className="col-start-2 text-[12.5px] text-foreground/70 sm:col-start-auto">{why}</span>}
                {i === 0 && (
                  <span className="col-start-2 w-fit rounded-[5px] bg-success/10 px-1.5 py-px text-[11px] font-semibold text-success sm:col-start-auto">
                    Phù hợp nhất
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setFinding(true)} className="text-[13px] font-semibold text-primary hover:underline">
          Tìm tổ chức khác
        </button>
        <span className="flex-1" />
        <Button onClick={submit} disabled={!pick.length || send.isPending} className="gap-2">
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Gửi yêu cầu báo giá ({pick.length})
        </Button>
      </div>

      {allowBroker && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            hoặc
          </div>
          <div className="flex flex-wrap items-center gap-3.5 rounded-[10px] bg-muted/40 px-3.5 py-3 sm:flex-nowrap">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-primary/5 text-primary" aria-hidden="true">
              <Sparkles className="h-[17px] w-[17px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Nhờ sàn chọn giúp</p>
              <p className="text-[12.5px] text-foreground/70">
                Chuyên viên sàn tìm và thương lượng với tổ chức phù hợp, bạn chỉ cần chọn báo giá.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setBrokering(true)}>
              Nhờ sàn
            </Button>
          </div>
        </>
      )}

      <FindOrgsDialog
        open={finding}
        onOpenChange={setFinding}
        posting={posting}
        sentOrgIds={sentOrgIds}
        activeCount={activeCount}
        allowBroker={allowBroker}
      />
      <BrokerRequestDialog open={brokering} onOpenChange={setBrokering} postingId={posting.id} />
    </KgCard>
  );
}

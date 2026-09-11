import { useEffect, useState } from "react";
import { FileSearch, ImageOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchPrefillSources, useSaveCaseFile } from "@/hooks/useSessionOutreach";
import { orgContactErrorMessage } from "@/lib/orgContacts/errors";
import { caseLot, parseCaseFile, prefillCaseFile, type CaseFile, type CaseLot } from "@/lib/outreach/caseFile";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import type { OutreachPack } from "@/types/outreach";

interface Props {
  session: AuctionSessionWithItems;
  pack: OutreachPack | null;
  auctionOrgId: string | null;
  readOnly: boolean;
}

const LOT_FIELDS: { key: keyof Omit<CaseLot, "photo_urls">; label: string; hint: string }[] = [
  { key: "description", label: "Mô tả tài sản", hint: "Diện tích, kết cấu, thông số, điểm nổi bật…" },
  { key: "condition", label: "Hiện trạng", hint: "VD: đang bỏ trống; xe vận hành bình thường" },
  { key: "legal_summary", label: "Tóm tắt pháp lý", hint: "Tình trạng giấy tờ, tranh chấp, thế chấp…" },
];

/** Phần hồ sơ vụ việc theo LÔ — đầu vào mô tả cho trình soạn. */
export function CaseFileCard({ session, pack, auctionOrgId, readOnly }: Props) {
  const save = useSaveCaseFile(session.id);
  const lots = session.auction_session_items;
  const [lotsDraft, setLotsDraft] = useState<CaseFile["lots"]>({});
  const [prefilling, setPrefilling] = useState(false);

  useEffect(() => setLotsDraft(parseCaseFile(pack?.case_file).lots), [pack?.case_file]);

  const locked = readOnly || !pack;
  const commit = (nextLots: CaseFile["lots"]) => {
    if (!pack) return;
    const server = parseCaseFile(pack.case_file);
    if (JSON.stringify(server.lots) === JSON.stringify(nextLots)) return;
    save.mutate({ packId: pack.id, caseFile: { ...server, lots: nextLots } });
  };
  const setLot = (itemId: string, patch: Partial<CaseLot>) =>
    setLotsDraft((cur) => ({ ...cur, [itemId]: { ...caseLot({ ...parseCaseFile({}), lots: cur }, itemId), ...patch } }));

  const prefill = async () => {
    if (!pack) return;
    setPrefilling(true);
    try {
      const listingIds = lots.map((l) => l.listing_id).filter((x): x is string => !!x);
      const { listings, consignments } = await fetchPrefillSources(listingIds, auctionOrgId, lots.some((l) => l.asset_posting_id));
      const server = parseCaseFile(pack.case_file);
      const next = prefillCaseFile({ ...server, lots: lotsDraft }, lots, listings, consignments);
      setLotsDraft(next.lots);
      commit(next.lots);
      toast.success("Đã điền các ô còn trống từ tin đăng / hồ sơ ký gửi. Ô bạn đã nhập được giữ nguyên.");
    } catch (e) {
      toast.error(orgContactErrorMessage(e));
    } finally {
      setPrefilling(false);
    }
  };

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Hồ sơ vụ việc theo lô</h2>
          <p className="text-sm text-muted-foreground">
            Giá, tiền đặt trước, giờ phiên lấy thẳng từ thông tin phiên. Ở đây bổ sung mô tả, hiện trạng, pháp lý và ảnh
            — trình soạn chỉ viết từ những gì có ở đây, không tự thêm dữ kiện.
          </p>
        </div>
        {!locked && lots.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={prefill} disabled={prefilling}>
            {prefilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
            Điền từ tin đăng / ký gửi
          </Button>
        )}
      </div>

      {lots.length === 0 && <p className="text-sm text-muted-foreground">Phiên chưa có tài sản.</p>}

      <div className="space-y-4">
        {lots.map((lot) => {
          const extra = caseLot({ ...parseCaseFile({}), lots: lotsDraft }, lot.id);
          return (
            <div key={lot.id} className="space-y-3 rounded-xl border p-4">
              <p className="font-medium text-foreground">
                Lô {lot.lot_no} · {lot.title}
              </p>
              <div className="grid gap-3 lg:grid-cols-3">
                {LOT_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    <Textarea
                      rows={4}
                      value={extra[f.key]}
                      placeholder={f.hint}
                      readOnly={locked}
                      onChange={(e) => setLot(lot.id, { [f.key]: e.target.value })}
                      onBlur={() => commit(lotsDraft)}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
              {extra.photo_urls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {extra.photo_urls.map((url) => (
                    <div key={url} className="relative">
                      <img src={url} alt="" className="h-16 w-24 rounded-md border object-cover" />
                      {!locked && (
                        <button
                          type="button"
                          aria-label="Bỏ ảnh"
                          className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5"
                          onClick={() => {
                            const nextLots = { ...lotsDraft, [lot.id]: { ...extra, photo_urls: extra.photo_urls.filter((u) => u !== url) } };
                            setLotsDraft(nextLots);
                            commit(nextLots);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ImageOff className="h-3.5 w-3.5" /> Chưa có ảnh — bấm "Điền từ tin đăng / ký gửi" để lấy ảnh nguồn.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

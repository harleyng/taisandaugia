import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAddSessionItems, useSessionSourceListings } from "@/hooks/useAuctionSessions";
import { useOrgServiceRequests } from "@/hooks/useOrgServiceRequests";
import { useSessionAuctionConsultSuggestions } from "@/hooks/useAuctionConsultSuggestions";
import { formatVnd } from "@/lib/advertising/slug";
import { listingToItemDraft, wonRequestToItemDraft } from "@/lib/auctionSessions/snapshot";
import type { AuctionSessionWithItems, SessionItemDraft, SessionItemSource } from "@/types/auction-session";
import { SourcePickList, type PickRow } from "./SourcePickList";
import { AuctionConsultSuggestionPanel } from "./AuctionConsultSuggestionPanel";

type MoneyOverride = Partial<Pick<SessionItemDraft, "starting_price" | "deposit_amount" | "bid_step">>;

interface Props {
  session: AuctionSessionWithItems;
  auctionOrgId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Hai nguồn tài sản gặp nhau ở đây:
 *  • tin đấu giá công khai của chính tổ chức (listings ACTIVE)
 *  • tài sản ký gửi chủ tài sản đã chọn tổ chức VÀ hợp đồng dịch vụ đã ký
 *    (org_service_requests: status 'selected' + contract_status 'signed')
 * Server kiểm lại cả hai (trigger auction_session_items_validate) — lọc ở đây chỉ là UI.
 */
export function AddSessionItemDialog({ session, auctionOrgId, open, onOpenChange }: Props) {
  const [tab, setTab] = useState<SessionItemSource>("listing");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const add = useAddSessionItems();
  const listingsQuery = useSessionSourceListings(auctionOrgId, open);
  const { requests, isLoading: requestsLoading, error: requestsError } = useOrgServiceRequests();
  // Đề xuất tư vấn đã được chủ tài sản chấp nhận — chỉ đổi giá trị lô khi tổ chức bấm "Áp dụng".
  const { map: suggestions } = useSessionAuctionConsultSuggestions(session.id, open);
  const [overrides, setOverrides] = useState<Record<string, MoneyOverride>>({});

  const inSession = useMemo(() => {
    const keys = new Set<string>();
    for (const item of session.auction_session_items) {
      if (item.listing_id) keys.add(`listing:${item.listing_id}`);
      if (item.asset_posting_id) keys.add(`posting:${item.asset_posting_id}`);
    }
    return keys;
  }, [session.auction_session_items]);

  const drafts = useMemo(() => {
    const map = new Map<string, SessionItemDraft>();
    for (const listing of listingsQuery.data ?? []) map.set(`listing:${listing.id}`, listingToItemDraft(listing));
    for (const request of requests) {
      if (request.status === "selected" && request.contract_status === "signed") {
        map.set(`posting:${request.posting_id}`, wonRequestToItemDraft(request));
      }
    }
    return map;
  }, [listingsQuery.data, requests]);

  const rowsFor = (source: SessionItemSource): PickRow[] =>
    [...drafts.entries()]
      .filter(([key]) => key.startsWith(`${source}:`))
      .map(([key, d]) => ({
        key,
        title: d.title,
        imageUrl: d.image_url,
        subtitle: [d.district, d.province].filter(Boolean).join(", ") || null,
        meta: d.starting_price != null ? `Giá khởi điểm ${formatVnd(d.starting_price)}` : "Chưa có giá khởi điểm",
        disabledReason: inSession.has(key) ? "Đã có trong phiên" : null,
        badge: key.startsWith("posting:") && suggestions.has(key.slice(8)) ? `Có đề xuất tư vấn v${suggestions.get(key.slice(8))!.version}` : null,
      }));
  const listingRows = rowsFor("listing");
  const postingRows = rowsFor("posting");
  const awaitingContract = requests.filter((r) => r.status === "selected" && r.contract_status !== "signed").length;

  const toggle = (key: string) => {
    const removing = selected.has(key);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    // Bỏ chọn ⇒ bỏ luôn giá trị đã áp dụng, chọn lại bắt đầu từ bản chụp gốc.
    if (removing) setOverrides(({ [key]: _dropped, ...rest }) => rest);
  };

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelected(new Set());
      setOverrides({});
    }
    onOpenChange(nextOpen);
  };

  const submit = () => {
    // Thứ tự chọn = thứ tự số lô.
    const picked = [...selected]
      .filter((key) => drafts.has(key))
      .map((key) => ({ ...drafts.get(key)!, ...overrides[key] }) as SessionItemDraft);
    if (picked.length === 0) return;
    add.mutate({ sessionId: session.id, drafts: picked }, { onSuccess: () => close(false) });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm tài sản vào phiên</DialogTitle>
          <DialogDescription>
            Chọn từ tin đấu giá của tổ chức hoặc tài sản ký gửi đã ký hợp đồng dịch vụ với chủ tài sản. Giá, tiền
            đặt trước, bước giá được chụp lại và sửa được sau.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as SessionItemSource)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="listing">Tin đấu giá công khai ({listingRows.length})</TabsTrigger>
            <TabsTrigger value="posting">Ký gửi đã ký HĐ ({postingRows.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="listing">
            <SourcePickList
              rows={listingRows}
              selected={selected}
              onToggle={toggle}
              loading={listingsQuery.isLoading}
              error={!!listingsQuery.error}
              emptyText="Tổ chức chưa có tin đấu giá nào đang hoạt động."
            />
          </TabsContent>
          <TabsContent value="posting">
            <SourcePickList
              rows={postingRows}
              selected={selected}
              onToggle={toggle}
              loading={requestsLoading}
              error={!!requestsError}
              emptyText="Chưa có tài sản ký gửi nào đã ký hợp đồng dịch vụ với tổ chức của bạn."
            />
            {[...selected]
              .filter((key) => key.startsWith("posting:") && suggestions.has(key.slice(8)) && drafts.has(key))
              .map((key) => {
                const d = { ...drafts.get(key)!, ...overrides[key] };
                return (
                  <div key={key} className="space-y-1 pt-3">
                    <p className="truncate text-xs font-medium text-foreground">{d.title}</p>
                    <AuctionConsultSuggestionPanel
                      compact
                      suggestion={suggestions.get(key.slice(8))!}
                      currentValues={{ starting_price: d.starting_price, deposit_amount: d.deposit_amount, bid_step: d.bid_step }}
                      onApply={(field, value) =>
                        setOverrides((o) => ({ ...o, [key]: { ...o[key], [field]: value } }))
                      }
                    />
                  </div>
                );
              })}
            {awaitingContract > 0 && (
              <p className="pt-2 text-xs text-muted-foreground">
                {awaitingContract} tài sản đã được chọn nhưng hợp đồng chưa được hai bên xác nhận ký — hoàn tất ở
                mục Yêu cầu ký gửi.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={add.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={selected.size === 0 || add.isPending} className="gap-1.5">
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {selected.size > 0 ? `Thêm ${selected.size} tài sản` : "Thêm tài sản"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

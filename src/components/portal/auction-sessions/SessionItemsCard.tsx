import { useState } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/lib/advertising/slug";
import type { AuctionSessionItem, AuctionSessionWithItems } from "@/types/auction-session";
import { AddSessionItemDialog } from "./AddSessionItemDialog";
import { EditSessionItemDialog } from "./EditSessionItemDialog";
import { RemoveSessionItemDialog } from "./RemoveSessionItemDialog";

const money = (v: number | null) => (v != null ? formatVnd(v) : "—");
const SOURCE_LABEL = { listing: "Tin công khai", posting: "Ký gửi" } as const;

interface Props {
  session: AuctionSessionWithItems;
  auctionOrgId: string | null;
  readOnly: boolean;
}

export function SessionItemsCard({ session, auctionOrgId, readOnly }: Props) {
  const items = session.auction_session_items;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AuctionSessionItem | null>(null);
  const [removing, setRemoving] = useState<AuctionSessionItem | null>(null);
  // Server chặn xoá lô cuối của phiên đã công bố — tắt nút trước để khỏi bấm vào lỗi.
  const lockLastLot = session.status === "published" && items.length <= 1;

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Tài sản trong phiên ({items.length})</h2>
          <p className="text-xs text-muted-foreground">
            Giá, tiền đặt trước và bước giá là bản chụp lúc thêm vào phiên — sửa được trước giờ đấu.
          </p>
        </div>
        {!readOnly && (
          <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)} disabled={!auctionOrgId}>
            <Plus className="h-4 w-4" />
            Thêm tài sản
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="space-y-2 rounded-xl border border-dashed border-border p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Chưa có tài sản nào. Phiên cần ít nhất 1 tài sản để công bố.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Lô</TableHead>
                <TableHead>Tài sản</TableHead>
                <TableHead className="text-right">Giá khởi điểm</TableHead>
                <TableHead className="text-right">Tiền đặt trước</TableHead>
                <TableHead className="text-right">Bước giá</TableHead>
                <TableHead className="text-right">Tối đa ĐK</TableHead>
                {!readOnly && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const sourceGone = !item.listing_id && !item.asset_posting_id;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-semibold">{item.lot_no}</TableCell>
                    <TableCell className="min-w-[14rem]">
                      <p className="font-medium text-foreground">{item.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[11px]">
                          {SOURCE_LABEL[item.source]}
                        </Badge>
                        {sourceGone && <span className="text-xs text-muted-foreground">Nguồn đã bị gỡ</span>}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">{money(item.starting_price)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{money(item.deposit_amount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{money(item.bid_step)}</TableCell>
                    <TableCell className="text-right">{item.max_registrants ?? "—"}</TableCell>
                    {!readOnly && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditing(item)} aria-label="Sửa lô">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRemoving(item)}
                            disabled={lockLastLot}
                            title={lockLastLot ? "Phiên đã công bố phải còn ít nhất 1 tài sản" : undefined}
                            aria-label="Gỡ lô"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!readOnly && (
        <>
          <AddSessionItemDialog session={session} auctionOrgId={auctionOrgId} open={adding} onOpenChange={setAdding} />
          <EditSessionItemDialog item={editing} onOpenChange={(open) => !open && setEditing(null)} />
          <RemoveSessionItemDialog item={removing} onOpenChange={(open) => !open && setRemoving(null)} />
        </>
      )}
    </Card>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAdPages, useUpsertAdPosition } from "@/hooks/useAdMasterData";
import { slugify, groupNumber, parseNumber } from "@/lib/advertising/slug";
import { ScheduleField } from "@/components/admin/marketing/ScheduleField";
import { AdvertisementBlock } from "@/components/AdvertisementBlock";
import type { AdPosition, PlacementType } from "@/types/advertising";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AdPosition | null;
}

const EMPTY = {
  page_id: "",
  name: "",
  placement_type: "slide" as PlacementType,
  price: 0,
  desktop_width: 795,
  desktop_height: 255,
  mobile_width: 375,
  mobile_height: 200,
  auction_ends_at: "",
  bidder_count: 0,
};

export function AdPositionFormDialog({ open, onOpenChange, editing }: Props) {
  const { data: pages } = useAdPages();
  const upsert = useUpsertAdPosition();
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        page_id: editing.page_id,
        name: editing.name,
        placement_type: editing.placement_type,
        price: editing.price,
        desktop_width: editing.desktop_width,
        desktop_height: editing.desktop_height,
        mobile_width: editing.mobile_width,
        mobile_height: editing.mobile_height,
        auction_ends_at: editing.auction_ends_at ?? "",
        bidder_count: editing.bidder_count,
      });
    } else {
      setForm({ ...EMPTY, page_id: pages?.[0]?.id ?? "" });
    }
  }, [open, editing, pages]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.page_id) return toast.error("Vui lòng chọn trang hiển thị");
    if (form.name.trim().length < 2) return toast.error("Vui lòng nhập tên vị trí");
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        page_id: form.page_id,
        name: form.name.trim(),
        code: slugify(form.name),
        placement_type: form.placement_type,
        price: Number(form.price) || 0,
        desktop_width: Number(form.desktop_width) || 0,
        desktop_height: Number(form.desktop_height) || 0,
        mobile_width: Number(form.mobile_width) || 0,
        mobile_height: Number(form.mobile_height) || 0,
        auction_ends_at: form.auction_ends_at || null,
        bidder_count: Number(form.bidder_count) || 0,
      });
      toast.success(editing ? "Đã cập nhật vị trí" : "Đã thêm vị trí");
      onOpenChange(false);
    } catch {
      toast.error("Thao tác thất bại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa vị trí hiển thị" : "Thêm vị trí hiển thị"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_360px] gap-8 py-1">
          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Trang hiển thị</Label>
              <Select value={form.page_id} onValueChange={(v) => set("page_id", v)}>
                <SelectTrigger><SelectValue placeholder="Chọn trang" /></SelectTrigger>
                <SelectContent>
                  {pages?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tên vị trí</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="VD: Header chính (Slider)" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Loại vị trí</Label>
                <Select value={form.placement_type} onValueChange={(v) => set("placement_type", v as PlacementType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slide">Slide (không giới hạn)</SelectItem>
                    <SelectItem value="unique">Duy nhất (giới hạn 1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Giá hiện tại (VND)</Label>
                <Input
                  inputMode="numeric"
                  value={form.price ? groupNumber(form.price) : ""}
                  onChange={(e) => set("price", parseNumber(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Phiên trả giá */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Số người đang trả giá</Label>
                <Input type="number" min={0} value={form.bidder_count} onChange={(e) => set("bidder_count", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Kết thúc phiên (đếm ngược)</Label>
                <ScheduleField value={form.auction_ends_at} onChange={(iso) => set("auction_ends_at", iso)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Kích thước Desktop (px)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} value={form.desktop_width} onChange={(e) => set("desktop_width", Number(e.target.value))} />
                  <span className="text-muted-foreground">×</span>
                  <Input type="number" min={0} value={form.desktop_height} onChange={(e) => set("desktop_height", Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Kích thước Mobile (px)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} value={form.mobile_width} onChange={(e) => set("mobile_width", Number(e.target.value))} />
                  <span className="text-muted-foreground">×</span>
                  <Input type="number" min={0} value={form.mobile_height} onChange={(e) => set("mobile_height", Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Xem trước card</Label>
            <AdvertisementBlock
              inline
              endsAt={form.auction_ends_at || null}
              bidderCount={Number(form.bidder_count) || 0}
              price={Number(form.price) || 0}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{editing ? "Lưu" : "Thêm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

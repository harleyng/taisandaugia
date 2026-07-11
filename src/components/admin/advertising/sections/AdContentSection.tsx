import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { useAdPages, useAdPositions } from "@/hooks/useAdMasterData";
import { NAV_TYPE_LABELS } from "@/lib/advertising/adStatus";
import type { AdFormState } from "@/lib/advertising/adForm";
import type { NavType, AdPosition } from "@/types/advertising";
import { BannerImageUpload } from "../BannerImageUpload";

interface Props {
  form: AdFormState;
  patch: (p: Partial<AdFormState>) => void;
  onPositionResolved?: (pos: AdPosition | null) => void;
}

export function AdContentSection({ form, patch, onPositionResolved }: Props) {
  const { data: pages } = useAdPages();
  const { data: positions } = useAdPositions();

  const selectedPos = positions?.find((p) => p.id === form.position_id) ?? null;
  const [pageId, setPageId] = useState<string>(selectedPos?.page_id ?? "");

  useEffect(() => {
    if (selectedPos && selectedPos.page_id !== pageId) setPageId(selectedPos.page_id);
  }, [selectedPos, pageId]);

  useEffect(() => {
    onPositionResolved?.(selectedPos);
  }, [selectedPos, onPositionResolved]);

  const posOptions = positions?.filter((p) => p.page_id === pageId) ?? [];

  const handlePageChange = (v: string) => {
    setPageId(v);
    if (selectedPos && selectedPos.page_id !== v) patch({ position_id: "" });
  };

  return (
    <div className="space-y-5">
      {/* Khu vực hiển thị */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          Khu vực hiển thị <span className="text-destructive">*</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Trang hiển thị</Label>
            <Select value={pageId} onValueChange={handlePageChange}>
              <SelectTrigger><SelectValue placeholder="Chọn trang hiển thị" /></SelectTrigger>
              <SelectContent>
                {pages?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Vị trí hiển thị</Label>
            <Select value={form.position_id} onValueChange={(v) => patch({ position_id: v })} disabled={!pageId}>
              <SelectTrigger><SelectValue placeholder="Chọn vị trí hiển thị" /></SelectTrigger>
              <SelectContent>
                {posOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.placement_type === "unique" ? "Duy nhất" : "Slide"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedPos?.placement_type === "unique" && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Vị trí duy nhất: chỉ 1 banner được chạy trong cùng khoảng thời gian. Nếu trùng lịch với banner khác, hệ thống sẽ báo lỗi khi lưu ở trạng thái lên lịch/hiển thị.
            </span>
          </div>
        )}
      </div>

      {/* Ảnh Banner */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          Ảnh <span className="text-destructive">*</span>
        </p>
        <div className="flex items-center gap-6 mb-3">
          <span className="w-28 shrink-0 text-sm text-muted-foreground">Thiết bị hiển thị:</span>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.show_desktop} onCheckedChange={(v) => patch({ show_desktop: !!v })} />
            Desktop
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.show_mobile} onCheckedChange={(v) => patch({ show_mobile: !!v })} />
            Mobile Web
          </label>
        </div>

        <div className="space-y-3">
          {form.show_desktop && (
            <BannerImageUpload
              label="Ảnh Desktop"
              value={form.desktop_image_url}
              onChange={(url) => patch({ desktop_image_url: url })}
              recommend={selectedPos ? `${selectedPos.desktop_width} × ${selectedPos.desktop_height}px` : "795 × 255px"}
            />
          )}
          {form.show_mobile && (
            <BannerImageUpload
              label="Ảnh Mobile"
              value={form.mobile_image_url}
              onChange={(url) => patch({ mobile_image_url: url })}
              recommend={selectedPos ? `${selectedPos.mobile_width} × ${selectedPos.mobile_height}px` : "375 × 200px"}
            />
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Lưu ý: Khi xuất ảnh vui lòng xuất ảnh 3x và đưa qua tinyPNG để nén size ảnh.</span>
        </div>
      </div>

      {/* Phương thức điều hướng */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          Phương thức điều hướng <span className="text-destructive">*</span>
        </p>
        <RadioGroup value={form.nav_type} onValueChange={(v) => patch({ nav_type: v as NavType })} className="space-y-2">
          {(["none", "link"] as NavType[]).map((t) => (
            <div key={t} className="flex items-center gap-2">
              <RadioGroupItem value={t} id={`nav-${t}`} />
              <Label htmlFor={`nav-${t}`} className="font-normal">{NAV_TYPE_LABELS[t]}</Label>
            </div>
          ))}
        </RadioGroup>
        {form.nav_type === "link" && (
          <Input
            className="mt-2"
            value={form.nav_url}
            onChange={(e) => patch({ nav_url: e.target.value })}
            placeholder="Nhập link điều hướng"
          />
        )}
      </div>
    </div>
  );
}

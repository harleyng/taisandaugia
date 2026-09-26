import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useAuthenticationPolicy, useSetAuthenticationPolicy } from "@/hooks/useAdminAuthenticationOrders";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";

/** Chính sách bắt buộc giám định tự động (BR-GD-03): nhóm tài sản + ngưỡng giá khởi điểm. */
export function AuthenticationPolicyCard() {
  const canEdit = useHasAdminPermission("tai-san-tu-nguyen", "approve");
  const { data: policy, isLoading } = useAuthenticationPolicy();
  const save = useSetAuthenticationPolicy();
  const [enabled, setEnabled] = useState(true);
  const [minPrice, setMinPrice] = useState(0);
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (!policy) return;
    setEnabled(policy.enabled);
    setMinPrice(Number(policy.min_price));
    setSlugs(policy.parent_slugs);
  }, [policy]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
      </div>
    );
  }

  const toggle = (slug: string, on: boolean) =>
    setSlugs((cur) => (on ? [...new Set([...cur, slug])] : cur.filter((s) => s !== slug)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Bật chính sách tự động</p>
          <p className="text-xs text-muted-foreground">
            Lô thuộc nhóm đã chọn, có giá khởi điểm từ ngưỡng trở lên, phải có chứng thư “xác thực” trước khi nộp.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!canEdit} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gd-min-price">Ngưỡng giá khởi điểm (VND)</Label>
        <Input
          id="gd-min-price"
          inputMode="numeric"
          className="max-w-xs"
          disabled={!canEdit}
          value={groupNumber(minPrice)}
          onChange={(e) => setMinPrice(parseNumber(e.target.value))}
        />
      </div>

      <div className="space-y-2">
        <Label>Nhóm tài sản áp dụng</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ASSET_CATEGORIES.map((c) => (
            <label key={c.slug} className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={slugs.includes(c.slug)}
                disabled={!canEdit}
                onCheckedChange={(v) => toggle(c.slug, v === true)}
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>

      {canEdit ? (
        <Button
          size="sm"
          disabled={slugs.length === 0 || save.isPending}
          onClick={() => save.mutate({ enabled, minPrice, parentSlugs: slugs })}
        >
          {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Lưu chính sách
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Cần quyền duyệt “Tài sản tự nguyện” để sửa chính sách.</p>
      )}
    </div>
  );
}

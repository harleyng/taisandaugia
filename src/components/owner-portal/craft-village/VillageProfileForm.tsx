import { lazy, Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { Field } from "@/components/asset-posting/fields";
import type { LatLng } from "@/components/craft-villages/CraftLocationPicker";
import { VIETNAM_PROVINCE_NAMES, VIETNAM_PROVINCE_NAMES_2025 } from "@/constants/vietnam-provinces";
import { Info, MapPinned } from "lucide-react";

// Bản đồ (maplibre) chỉ tải khi vào trang này.
const CraftLocationPicker = lazy(() => import("@/components/craft-villages/CraftLocationPicker"));

// Dữ liệu cũ ghi tên tỉnh trước sáp nhập ⇒ gợi ý cả hai bộ tên.
const PROVINCE_OPTIONS = [...new Set([...VIETNAM_PROVINCE_NAMES_2025, ...VIETNAM_PROVINCE_NAMES])];
export const INTRO_MAX = 2000;

export interface VillageFormValue {
  product: string;
  province: string;
  intro: string;
  loc: LatLng | null;
  published: boolean;
}

interface Props {
  value: VillageFormValue;
  onChange: (patch: Partial<VillageFormValue>) => void;
  readOnly: boolean;
}

/** Thông tin chung của làng: công khai, sản phẩm chính, tỉnh, giới thiệu, vị trí trên bản đồ. */
export function VillageProfileForm({ value, onChange, readOnly }: Props) {
  return (
    <>
      <SectionCard title="Thông tin chung" icon={Info}>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <label htmlFor="village-publish" className="text-[13.5px] font-semibold text-foreground">
              Công khai làng lên bản đồ làng nghề
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Làng hiện trên /lang-nghe khi có ít nhất một hồ sơ đã duyệt được bật “Hiện trong trang làng”.
              </span>
            </label>
            <Switch
              id="village-publish"
              checked={value.published}
              onCheckedChange={(published) => onChange({ published })}
              disabled={readOnly}
            />
          </div>

          <Field label="Sản phẩm chính" req>
            <Input
              value={value.product}
              onChange={(e) => onChange({ product: e.target.value })}
              maxLength={80}
              placeholder="VD: Gốm sứ, Lụa tơ tằm, Dao kéo rèn tay"
              disabled={readOnly}
            />
          </Field>

          <Field label="Tỉnh / thành phố">
            <Input
              value={value.province}
              onChange={(e) => onChange({ province: e.target.value })}
              maxLength={60}
              list="village-province-options"
              placeholder="VD: Hà Nội"
              disabled={readOnly}
            />
            <datalist id="village-province-options">
              {PROVINCE_OPTIONS.map((p) => <option key={p} value={p} />)}
            </datalist>
          </Field>

          <Field label="Giới thiệu làng" help={`${value.intro.length.toLocaleString("en-US")} / ${INTRO_MAX.toLocaleString("en-US")} ký tự`}>
            <Textarea
              value={value.intro}
              onChange={(e) => onChange({ intro: e.target.value })}
              maxLength={INTRO_MAX}
              rows={5}
              placeholder="Lịch sử làng nghề, sản phẩm tiêu biểu, nghệ nhân, cách ghé thăm…"
              disabled={readOnly}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Vị trí làng nghề" icon={MapPinned}>
        <Field label="Vị trí trên bản đồ" req help="Bấm lên bản đồ hoặc kéo ghim tới đúng vị trí làng.">
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <CraftLocationPicker
              value={value.loc}
              onChange={(loc) => onChange({ loc })}
              disabled={readOnly}
              className="h-64 w-full"
            />
          </Suspense>
        </Field>
        {value.loc && (
          <p className="mt-2 text-xs tabular-nums text-muted-foreground">
            {value.loc.lat.toFixed(5)}, {value.loc.lng.toFixed(5)}
          </p>
        )}
      </SectionCard>
    </>
  );
}

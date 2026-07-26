import { Info, MapPin, Ruler } from "lucide-react";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { Group, OptionalGroup, TextField, SelectField, DeltaField } from "../fields";
import type { WizardValues } from "../wizardSchema";

interface StepProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  errs: Record<string, string>;
}

const CHILD_NAME: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((c) => c.children.map((ch) => [ch.slug, ch.name])),
);

/** Bước 2: nhận diện tài sản (tên, khu vực) + thông số theo loại + thông số phụ. */
export function Step2GeneralInfo({ f, up, errs }: StepProps) {
  const deltas = getDeltaFields(f.childSlug);
  const req = deltas.filter((d) => d.required);
  const opt = deltas.filter((d) => !d.required);
  const prov = vietnamProvinces.find((p) => p.name === f.province);
  const dist = prov?.districts.find((d) => d.name === f.district);
  const setDelta = (k: string) => (v: string) => up({ deltaFields: { ...f.deltaFields, [k]: v } });

  return (
    <div className="flex flex-col gap-4">
      <Group icon={<Info className="h-4 w-4" />} title="Nhận diện tài sản">
        <div className="flex flex-col gap-[18px]">
          <TextField
            label="Tên tài sản"
            req
            placeholder="VD: Quyền sử dụng đất tại 12 Nguyễn Huệ, Quận 1"
            value={f.title}
            onChange={(v) => up({ title: v })}
            err={errs.title}
          />
          <SelectField
            label="Tỉnh / Thành phố"
            req
            options={vietnamProvinces.map((p) => p.name)}
            value={f.province}
            onChange={(v) => up({ province: v, district: "", ward: "" })}
            err={errs.province}
            placeholder="Chọn tỉnh / thành phố"
          />
        </div>
      </Group>

      {req.length > 0 && (
        <Group icon={<Ruler className="h-4 w-4" />} title="Thông số theo loại tài sản" desc={CHILD_NAME[f.childSlug]}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {req.map((d) => (
              <DeltaField key={d.key} d={d} value={f.deltaFields[d.key]} onChange={setDelta(d.key)} err={errs[`delta.${d.key}`]} />
            ))}
          </div>
        </Group>
      )}

      <OptionalGroup icon={<MapPin className="h-4 w-4" />} title="Thông số phụ" desc="Địa chỉ chi tiết, mô tả, thông số bổ sung" count={opt.length + 4}>
        <div className="flex flex-col gap-[18px]">
          {opt.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {opt
                  .filter((d) => d.type !== "textarea")
                  .map((d) => (
                    <DeltaField key={d.key} d={d} value={f.deltaFields[d.key]} onChange={setDelta(d.key)} />
                  ))}
              </div>
              {opt
                .filter((d) => d.type === "textarea")
                .map((d) => (
                  <DeltaField key={d.key} d={d} value={f.deltaFields[d.key]} onChange={setDelta(d.key)} />
                ))}
            </>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Quận / Huyện"
              options={prov?.districts.map((d) => d.name) ?? []}
              value={f.district}
              onChange={(v) => up({ district: v, ward: "" })}
              disabled={!prov}
              placeholder={prov ? "Chọn" : "Chọn tỉnh trước"}
            />
            <SelectField
              label="Phường / Xã"
              options={dist?.wards ?? []}
              value={f.ward}
              onChange={(v) => up({ ward: v })}
              disabled={!dist}
              placeholder={dist ? "Chọn" : "Chọn quận trước"}
            />
          </div>
          <TextField label="Địa chỉ cụ thể" placeholder="Số nhà, tên đường…" value={f.address} onChange={(v) => up({ address: v })} />
          <TextField
            label="Mô tả"
            rows={3}
            placeholder="Vị trí, hiện trạng sử dụng, ưu điểm…"
            value={f.description ?? ""}
            onChange={(v) => up({ description: v })}
          />
        </div>
      </OptionalGroup>
    </div>
  );
}

import { useState } from "react";
import { Info, MapPin, Ruler, Gavel, Scale, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { Group, TextField, SelectField, DeltaField, SegYesNo, Switch } from "@/components/asset-posting/fields";
import {
  AUCTION_FORMAT_LABELS,
  EXPECTED_TIMELINE_LABELS,
  PRICING_MODE_LABELS,
  type AuctionFormat,
  type ExpectedTimeline,
  type PricingMode,
} from "@/types/asset-posting";
import { useUpdateAssetPostingByAdmin, type AdminPostingPatch } from "@/hooks/useAdminAssetPostings";
import type { AdminAssetPosting } from "@/hooks/useAdminAssetPostings";

// Dùng lại nguyên bộ atom của wizard số hoá (Group/TextField/DeltaField/…) và
// state thuần như wizard, thay vì dựng RHF riêng: cùng một tập trường, nếu tách
// hai cách nhập thì mỗi lần thêm delta field lại phải sửa hai nơi.

const opts = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));

const yn = (v: boolean | null) => (v === null ? "" : v ? "yes" : "no");
const toBool = (v: string) => (v === "" ? null : v === "yes");
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

interface Props {
  posting: AdminAssetPosting;
  onDone: () => void;
}

/** Admin bổ sung / sửa thông tin tài sản trước khi duyệt. */
export function AssetPostingEditForm({ posting, onDone }: Props) {
  const save = useUpdateAssetPostingByAdmin();
  const deltas = getDeltaFields(posting.child_slug);

  const [f, setF] = useState({
    title: posting.title,
    description: posting.description ?? "",
    province: posting.province ?? "",
    district: posting.district ?? "",
    ward: posting.ward ?? "",
    address: posting.address ?? "",
    pricing_mode: posting.pricing_mode as PricingMode,
    starting_price: posting.starting_price != null ? String(posting.starting_price) : "",
    auction_format: posting.auction_format as AuctionFormat,
    commission_pct: posting.commission_pct != null ? String(posting.commission_pct) : "",
    expected_timeline: (posting.expected_timeline ?? "") as ExpectedTimeline | "",
    has_dispute: yn(posting.has_dispute),
    has_mortgage: yn(posting.has_mortgage),
    is_seized: yn(posting.is_seized),
    right_to_sell: posting.right_to_sell,
    legal_notes: posting.legal_notes ?? "",
    deltaFields: { ...(posting.delta_fields ?? {}) } as Record<string, unknown>,
  });

  const up = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));
  const setDelta = (k: string) => (v: string) => up({ deltaFields: { ...f.deltaFields, [k]: v } });

  const prov = vietnamProvinces.find((p) => p.name === f.province);
  const dist = prov?.districts.find((d) => d.name === f.district);

  const titleErr = f.title.trim().length < 3 ? "Tên tài sản tối thiểu 3 ký tự" : undefined;

  const submit = () => {
    if (titleErr) return;
    const patch: AdminPostingPatch = {
      title: f.title.trim(),
      description: f.description.trim() || null,
      province: f.province || null,
      district: f.district || null,
      ward: f.ward || null,
      address: f.address.trim() || null,
      pricing_mode: f.pricing_mode,
      // Nhờ định giá thì giá khởi điểm do tổ chức đấu giá xác định, không giữ số cũ.
      starting_price: f.pricing_mode === "self" ? numOrNull(f.starting_price) : null,
      auction_format: f.auction_format,
      commission_pct: numOrNull(f.commission_pct),
      expected_timeline: f.expected_timeline || null,
      has_dispute: toBool(f.has_dispute),
      has_mortgage: toBool(f.has_mortgage),
      is_seized: toBool(f.is_seized),
      right_to_sell: f.right_to_sell,
      legal_notes: f.legal_notes.trim() || null,
      delta_fields: f.deltaFields,
    };
    save.mutate({ id: posting.id, patch }, { onSuccess: onDone });
  };

  return (
    <div className="flex flex-col gap-4">
      <Group icon={<Info className="h-4 w-4" />} title="Nhận diện tài sản">
        <div className="flex flex-col gap-[18px]">
          <TextField label="Tên tài sản" req value={f.title} onChange={(v) => up({ title: v })} err={titleErr} />
          <TextField label="Mô tả" rows={3} value={f.description} onChange={(v) => up({ description: v })} />
        </div>
      </Group>

      <Group icon={<MapPin className="h-4 w-4" />} title="Khu vực">
        <div className="flex flex-col gap-[18px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectField
              label="Tỉnh / Thành phố"
              options={vietnamProvinces.map((p) => p.name)}
              value={f.province}
              onChange={(v) => up({ province: v, district: "", ward: "" })}
              placeholder="Chọn tỉnh / thành phố"
            />
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
          <TextField label="Địa chỉ cụ thể" value={f.address} onChange={(v) => up({ address: v })} />
        </div>
      </Group>

      {deltas.length > 0 && (
        <Group icon={<Ruler className="h-4 w-4" />} title="Thông số tài sản">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {deltas.map((d) => (
              <DeltaField key={d.key} d={d} value={f.deltaFields[d.key]} onChange={setDelta(d.key)} />
            ))}
          </div>
        </Group>
      )}

      <Group icon={<Gavel className="h-4 w-4" />} title="Nhu cầu đấu giá">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Cách định giá"
            options={opts(PRICING_MODE_LABELS)}
            value={f.pricing_mode}
            onChange={(v) => up({ pricing_mode: v as PricingMode })}
          />
          {f.pricing_mode === "self" && (
            <TextField
              label="Giá khởi điểm"
              type="number"
              unit="₫"
              value={f.starting_price}
              onChange={(v) => up({ starting_price: v })}
            />
          )}
          <SelectField
            label="Hình thức đấu giá"
            options={opts(AUCTION_FORMAT_LABELS)}
            value={f.auction_format}
            onChange={(v) => up({ auction_format: v as AuctionFormat })}
          />
          <TextField
            label="Thù lao chấp nhận"
            type="number"
            unit="%"
            value={f.commission_pct}
            onChange={(v) => up({ commission_pct: v })}
          />
          <SelectField
            label="Thời gian kỳ vọng"
            options={opts(EXPECTED_TIMELINE_LABELS)}
            value={f.expected_timeline}
            onChange={(v) => up({ expected_timeline: v as ExpectedTimeline })}
            placeholder="Chọn"
          />
        </div>
      </Group>

      <Group icon={<Scale className="h-4 w-4" />} title="Pháp lý & hiện trạng">
        <div className="flex flex-col gap-[18px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(
              [
                ["has_dispute", "Đang tranh chấp"],
                ["has_mortgage", "Đang thế chấp"],
                ["is_seized", "Bị kê biên"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-[13.5px] font-semibold text-foreground">{label}</label>
                <SegYesNo value={f[key]} onChange={(v) => up({ [key]: v } as Partial<typeof f>)} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4">
            <label className="text-[13.5px] font-semibold text-foreground">Có quyền được bán</label>
            <Switch on={f.right_to_sell} onChange={(v) => up({ right_to_sell: v })} />
          </div>
          <TextField label="Ghi chú pháp lý" rows={2} value={f.legal_notes} onChange={(v) => up({ legal_notes: v })} />
        </div>
      </Group>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={save.isPending} className="gap-1.5">
          <X className="h-4 w-4" />
          Huỷ
        </Button>
        <Button onClick={submit} disabled={save.isPending || !!titleErr} className="gap-1.5">
          <Save className="h-4 w-4" />
          {save.isPending ? "Đang lưu..." : "Lưu thông tin"}
        </Button>
      </div>
    </div>
  );
}

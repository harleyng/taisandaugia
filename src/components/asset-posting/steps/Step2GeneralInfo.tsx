import { AlertCircle, Camera, Info, MapPin, Ruler } from "lucide-react";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { Group, OptionalGroup, Pill, TextField, SelectField, DeltaField } from "../fields";
import { AiExtractionCard } from "../AiExtractionCard";
import { AiFieldSuggestion } from "../AiFieldSuggestion";
import { AssetMediaUpload } from "../AssetMediaUpload";
import { AssetVideoUpload } from "../AssetVideoUpload";
import { mediaSignature } from "@/lib/aiMediaExtraction";
import type { UseAiMediaExtraction } from "@/hooks/useAiMediaExtraction";
import { applyExtractedFields, fieldCurrentValue, type WizardValues } from "../wizardSchema";

interface StepProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  errs: Record<string, string>;
  /** State trích xuất AI — giữ ở cấp wizard để không mất khi qua bước khác rồi quay lại. */
  ai: UseAiMediaExtraction;
}

const CHILD_NAME: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((c) => c.children.map((ch) => [ch.slug, ch.name])),
);

/** Bước 2: nhận diện tài sản (tên, khu vực) + thông số theo loại + thông số phụ. */
export function Step2GeneralInfo({ f, up, errs, ai }: StepProps) {
  const deltas = getDeltaFields(f.childSlug);
  const req = deltas.filter((d) => d.required);
  const opt = deltas.filter((d) => !d.required);
  const prov = vietnamProvinces.find((p) => p.name === f.province);
  const dist = prov?.districts.find((d) => d.name === f.district);
  const setDelta = (k: string) => (v: string) => up({ deltaFields: { ...f.deltaFields, [k]: v } });

  // Kết quả AI chỉ còn giá trị khi ảnh và loại tài sản vẫn là bộ đã phân tích.
  // Lệch signature ⇒ coi như chưa có gợi ý; card sẽ mời người dùng phân tích lại.
  const signature = mediaSignature({
    childSlug: f.childSlug,
    imageUrls: f.imageUrls,
    videoUrls: f.videoUrls,
  });
  const aiFields =
    ai.state.phase === "done" && ai.state.result.signature === signature ? ai.state.result.fields : [];

  /**
   * Nhận quận/phường mà tỉnh còn trống thì ô đó bị disable và giá trị không hiện
   * ra được — nên kéo theo cả gợi ý tỉnh. Ngược lại chỉ áp đúng trường được bấm.
   */
  const pathsFor = (path: string): string[] =>
    (path === "district" || path === "ward") && !f.province && aiFields.some((x) => x.path === "province")
      ? ["province", path]
      : [path];

  /** Gợi ý còn hiệu lực cho một trường, hoặc undefined nếu không có / đã duyệt. */
  const suggest = (path: string) => {
    if (ai.resolved.has(path)) return undefined;
    const field = aiFields.find((x) => x.path === path);
    if (!field) return undefined;
    return (
      <AiFieldSuggestion
        field={field}
        hasValue={fieldCurrentValue(f, path) !== ""}
        onUse={() => {
          const paths = pathsFor(path);
          up(applyExtractedFields(f, aiFields, new Set(paths)));
          ai.resolve(paths);
        }}
        onDismiss={() => ai.resolve([path])}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ảnh đứng ĐẦU bước 2 một cách có chủ ý: đây là thứ duy nhất người dùng
          lấy từ túi ra là có ngay, và là nguyên liệu để AI điền hộ mọi khối bên
          dưới. Bắt gõ tên tài sản trước rồi mới cho upload là đảo ngược thứ tự
          công việc thật.
          (Khối này từng nằm trong nhánh wantsAuction === "yes" ở bước 4 nên luồng
          "chỉ số hoá" không bao giờ thấy nó — bắt buộc mà để nguyên đó là chặn
          cứng luồng ấy.) */}
      <Group
        icon={<Camera className="h-4 w-4" />}
        title="Hình ảnh & video tài sản"
        desc="Tối thiểu 1 ảnh. Tải ảnh lên trước để AI đọc và điền giúp các mục bên dưới."
        right={f.imageUrls.length > 0 ? <Pill tone="ok">{f.imageUrls.length} ảnh</Pill> : null}
      >
        <label className="block text-[13.5px] font-semibold text-foreground mb-2">
          Ảnh thực tế tài sản<span className="ml-0.5 text-destructive">*</span>
        </label>
        <AssetMediaUpload value={f.imageUrls} onChange={(v) => up({ imageUrls: v })} />
        {errs.imageUrls && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive mt-2.5">
            <AlertCircle className="h-3.5 w-3.5" /> {errs.imageUrls}
          </div>
        )}

        <label className="block text-[13.5px] font-semibold text-foreground mb-2 mt-4">
          Video tài sản <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
        </label>
        <AssetVideoUpload value={f.videoUrls} onChange={(v) => up({ videoUrls: v })} />

        {/* Banner đi LIỀN với ô upload: nó chỉ chạy được khi đã có ảnh, và đây là
            chỗ người dùng vừa nhìn thấy ảnh của mình. Gợi ý từng trường thì hiện
            dưới đúng ô tương ứng ở các khối bên dưới. */}
        <div className="mt-4">
          <AiExtractionCard f={f} up={up} ai={ai} />
        </div>
      </Group>

      <Group icon={<Info className="h-4 w-4" />} title="Nhận diện tài sản">
        <div className="flex flex-col gap-[18px]">
          <TextField
            label="Tên tài sản"
            req
            placeholder="VD: Quyền sử dụng đất tại 12 Nguyễn Huệ, Quận 1"
            value={f.title}
            onChange={(v) => up({ title: v })}
            err={errs.title}
            suggestion={suggest("title")}
          />
          <SelectField
            label="Tỉnh / Thành phố"
            req
            options={vietnamProvinces.map((p) => p.name)}
            value={f.province}
            onChange={(v) => up({ province: v, district: "", ward: "" })}
            err={errs.province}
            placeholder="Chọn tỉnh / thành phố"
            suggestion={suggest("province")}
          />
        </div>
      </Group>

      {req.length > 0 && (
        <Group icon={<Ruler className="h-4 w-4" />} title="Thông số theo loại tài sản" desc={CHILD_NAME[f.childSlug]}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {req.map((d) => (
              <DeltaField
                key={d.key}
                d={d}
                value={f.deltaFields[d.key]}
                onChange={setDelta(d.key)}
                err={errs[`delta.${d.key}`]}
                suggestion={suggest(`delta.${d.key}`)}
              />
            ))}
          </div>
        </Group>
      )}

      {/* defaultOpen: khối này cũng nhận gợi ý AI (mô tả, quận/phường, thông số
          tuỳ chọn). Thu gọn mặc định thì người dùng bấm "Trích xuất" xong không
          thấy phần lớn kết quả ở đâu cả. */}
      <OptionalGroup
        icon={<MapPin className="h-4 w-4" />}
        title="Thông số phụ"
        desc="Địa chỉ chi tiết, mô tả, thông số bổ sung"
        count={opt.length + 4}
        defaultOpen
      >
        <div className="flex flex-col gap-[18px]">
          {opt.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {opt
                  .filter((d) => d.type !== "textarea")
                  .map((d) => (
                    <DeltaField
                      key={d.key}
                      d={d}
                      value={f.deltaFields[d.key]}
                      onChange={setDelta(d.key)}
                      suggestion={suggest(`delta.${d.key}`)}
                    />
                  ))}
              </div>
              {opt
                .filter((d) => d.type === "textarea")
                .map((d) => (
                  <DeltaField
                    key={d.key}
                    d={d}
                    value={f.deltaFields[d.key]}
                    onChange={setDelta(d.key)}
                    suggestion={suggest(`delta.${d.key}`)}
                  />
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
              suggestion={suggest("district")}
            />
            <SelectField
              label="Phường / Xã"
              options={dist?.wards ?? []}
              value={f.ward}
              onChange={(v) => up({ ward: v })}
              disabled={!dist}
              placeholder={dist ? "Chọn" : "Chọn quận trước"}
              suggestion={suggest("ward")}
            />
          </div>
          <TextField label="Địa chỉ cụ thể" placeholder="Số nhà, tên đường…" value={f.address} onChange={(v) => up({ address: v })} />
          <TextField
            label="Mô tả"
            rows={3}
            placeholder="Vị trí, hiện trạng sử dụng, ưu điểm…"
            value={f.description ?? ""}
            onChange={(v) => up({ description: v })}
            suggestion={suggest("description")}
          />
        </div>
      </OptionalGroup>
    </div>
  );
}

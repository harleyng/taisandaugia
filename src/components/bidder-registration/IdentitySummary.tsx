import { KycImageThumb } from "@/components/ekyc/KycImageThumb";
import type { IdentityBlockValues } from "@/lib/biddingContracts/registrationForm";
import { GENDER_LABELS, ID_TYPE_LABELS, KYC_FIELD_LABELS, type KycField } from "@/types/bidding-contract";

const formatDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("vi-VN") : "—");

/** Thẻ đọc một khối danh tính: thông tin + ảnh giấy tờ (dùng ở bước Danh tính và bước Xác nhận). */
export function IdentitySummary({ value, extra }: { value: IdentityBlockValues; extra?: [string, string][] }) {
  const rows: [string, string][] = [
    ["Họ và tên", value.full_name || "—"],
    [ID_TYPE_LABELS[value.id_type], value.id_number || "—"],
    ["Ngày sinh", formatDate(value.date_of_birth)],
    ["Giới tính", value.gender ? GENDER_LABELS[value.gender] : "—"],
    ["Nơi thường trú", value.address || "—"],
    ...(extra ?? []),
  ];
  const images = [
    value.id_front_path && { path: value.id_front_path, alt: "Ảnh mặt trước" },
    value.id_type === "cccd" && value.id_back_path && { path: value.id_back_path, alt: "Ảnh mặt sau" },
  ].filter((x): x is { path: string; alt: string } => !!x);

  return (
    <div className="space-y-3">
      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[10rem_1fr]">
        {rows.map(([label, v]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      {value.edited_fields.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Đã sửa sau khi đọc tự động:{" "}
          {value.edited_fields.map((f) => KYC_FIELD_LABELS[f as KycField] ?? f).join(", ")}
        </p>
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <KycImageThumb key={img.path} path={img.path} alt={img.alt} className="h-24 w-36" />
          ))}
        </div>
      )}
    </div>
  );
}

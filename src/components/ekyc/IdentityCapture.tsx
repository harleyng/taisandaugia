import { useEffect, useId, useRef, useState } from "react";
import { Loader2, QrCode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoBox } from "@/components/shared/InfoBox";
import { useAuth } from "@/contexts/AuthContext";
import { applyRead, editField, type CaptureField } from "@/lib/ekyc/identityCapture";
import type { KycValues } from "@/lib/ekyc/editedFields";
import type { IdentityCaptureValues } from "@/lib/ekyc/kycProfileForm";
import { readIdentityFromPhotos } from "@/lib/ekyc/readIdentityFromPhotos";
import { uploadKycImage } from "@/lib/ekyc/uploadKycImage";
import { GENDER_LABELS, ID_TYPE_LABELS, type IdType } from "@/types/bidding-contract";
import { IdImageSlot } from "./IdImageSlot";

const NO_GENDER = "__none__";

type Side = "front" | "back";
type ReadOutcome = "reading" | "qr" | "ocr" | "failed" | null;

export type IdentityCaptureErrors = Partial<Record<CaptureField, string>>;

interface Props {
  value: IdentityCaptureValues;
  onChange: (next: IdentityCaptureValues) => void;
  errors?: IdentityCaptureErrors;
  disabled?: boolean;
  /** Hiện ô Ngày cấp (danh tính lưu trên hồ sơ; form đăng ký không cần). */
  withIssuedOn?: boolean;
  /** Ngày sinh bắt buộc (RPC lưu danh tính đòi). */
  dobRequired?: boolean;
  /** Mỗi tệp vừa tải lên — nơi gọi dọn tệp không dùng khi huỷ. */
  onUploaded?: (path: string) => void;
  /** Đang tải ảnh / đọc mã — nơi gọi khoá nút lưu & đóng. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Chụp 2 mặt giấy tờ ⇒ đọc mã QR mặt trước CCCD (lùi về OCR / tự nhập) ⇒ điền sẵn
 * form, MỌI ô vẫn sửa được, ô sửa sau khi máy đọc gắn nhãn "Đã sửa" (tổ chức soi
 * kỹ khi duyệt). Component có kiểm soát: giá trị + kiểm lỗi do nơi gọi giữ.
 */
export function IdentityCapture({
  value,
  onChange,
  errors = {},
  disabled,
  withIssuedOn,
  dobRequired,
  onUploaded,
  onBusyChange,
}: Props) {
  const uid = useId();
  const { userId } = useAuth();
  const [decoded, setDecoded] = useState<KycValues | null>(null);
  const [outcome, setOutcome] = useState<ReadOutcome>(null);
  const [uploading, setUploading] = useState<Record<Side, boolean>>({ front: false, back: false });
  const [uploadError, setUploadError] = useState<Partial<Record<Side, string>>>({});
  const [preview, setPreview] = useState<Partial<Record<Side, string>>>({});

  // Upload + đọc mã là bất đồng bộ: luôn ghép vào giá trị MỚI NHẤT, không phải bản lúc chọn ảnh.
  const valueRef = useRef(value);
  valueRef.current = value;

  const busy = uploading.front || uploading.back || outcome === "reading";
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  // Dọn object URL xem trước khi đổi ảnh / rời màn.
  const previewRef = useRef(preview);
  previewRef.current = preview;
  useEffect(() => () => Object.values(previewRef.current).forEach((u) => u && URL.revokeObjectURL(u)), []);

  const isCccd = value.id_type === "cccd";
  const edited = new Set(value.edited_fields);

  const set = (field: CaptureField, input: string | null) => onChange(editField(value, field, input, decoded));

  const setIdType = (t: IdType) => {
    if (t === value.id_type) return;
    onChange({ ...value, id_type: t });
  };

  const handleFile = async (side: Side, file: File) => {
    if (!userId) return;
    setUploadError((e) => ({ ...e, [side]: undefined }));
    setUploading((u) => ({ ...u, [side]: true }));
    const local = URL.createObjectURL(file);
    setPreview((p) => {
      if (p[side]) URL.revokeObjectURL(p[side]!);
      return { ...p, [side]: local };
    });

    // Đọc từ tệp GỐC (trước khi nén) song song với tải lên.
    const reading = side === "front" ? readIdentityFromPhotos({ id_type: value.id_type, front: file }) : null;
    if (reading) setOutcome("reading");

    try {
      const [path, read] = await Promise.all([uploadKycImage(userId, file, "image"), reading]);
      onUploaded?.(path);
      const key = side === "front" ? "id_front_path" : "id_back_path";
      let next: IdentityCaptureValues = { ...valueRef.current, [key]: path };
      if (side === "front") {
        next = applyRead(next, read);
        setDecoded(read?.values ?? null);
        setOutcome(read ? read.method : "failed");
      }
      onChange(next);
    } catch (err) {
      setUploadError((e) => ({ ...e, [side]: err instanceof Error ? err.message : "Tải ảnh lên không thành công" }));
      setPreview((p) => {
        URL.revokeObjectURL(local);
        return { ...p, [side]: undefined };
      });
      if (side === "front") setOutcome(null);
    } finally {
      setUploading((u) => ({ ...u, [side]: false }));
    }
  };

  const fieldLabel = (field: CaptureField, text: string, required?: boolean) => (
    <Label htmlFor={`${uid}-${field}`} className="flex items-center gap-2">
      <span>
        {text} {required && <span className="text-destructive">*</span>}
      </span>
      {edited.has(field) && (
        <span className="rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
          Đã sửa
        </span>
      )}
    </Label>
  );

  const err = (field: CaptureField) =>
    errors[field] ? <p className="text-sm font-medium text-destructive">{errors[field]}</p> : null;

  const textField = (field: CaptureField, text: string, opts: { required?: boolean; type?: string; inputMode?: "numeric" | "text"; wide?: boolean } = {}) => (
    <div className={opts.wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      {fieldLabel(field, text, opts.required)}
      <Input
        id={`${uid}-${field}`}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        value={(value[field] as string | null | undefined) ?? ""}
        onChange={(e) => set(field, e.target.value)}
        disabled={disabled}
        aria-invalid={!!errors[field]}
      />
      {err(field)}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Loại giấy tờ <span className="text-destructive">*</span>
        </p>
        <RadioGroup
          value={value.id_type}
          onValueChange={(v) => setIdType(v as IdType)}
          className="flex flex-wrap gap-4"
          disabled={disabled || busy}
        >
          {(Object.keys(ID_TYPE_LABELS) as IdType[]).map((t) => (
            <label key={t} htmlFor={`${uid}-type-${t}`} className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem id={`${uid}-type-${t}`} value={t} />
              {t === "cccd" ? "CCCD / Thẻ căn cước" : ID_TYPE_LABELS[t]}
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <IdImageSlot
          label={isCccd ? "Ảnh mặt trước" : "Ảnh trang thông tin hộ chiếu"}
          required
          path={value.id_front_path}
          localPreview={preview.front}
          uploading={uploading.front}
          disabled={disabled}
          error={uploadError.front ?? errors.id_front_path}
          hint={isCccd ? "Mặt có ảnh chân dung và mã QR" : undefined}
          onFile={(f) => handleFile("front", f)}
        />
        {isCccd && (
          <IdImageSlot
            label="Ảnh mặt sau"
            required
            path={value.id_back_path}
            localPreview={preview.back}
            uploading={uploading.back}
            disabled={disabled}
            error={uploadError.back ?? errors.id_back_path}
            onFile={(f) => handleFile("back", f)}
          />
        )}
      </div>

      <ReadNotice outcome={outcome} isCccd={isCccd} />

      <div className="grid gap-4 sm:grid-cols-2">
        {textField("full_name", "Họ và tên", { required: true, wide: true })}
        {textField("id_number", isCccd ? "Số CCCD" : "Số hộ chiếu", {
          required: true,
          inputMode: isCccd ? "numeric" : "text",
        })}
        {textField("date_of_birth", "Ngày sinh", { required: dobRequired, type: "date" })}
        <div className="space-y-1.5">
          {fieldLabel("gender", "Giới tính")}
          <Select
            value={value.gender || NO_GENDER}
            onValueChange={(v) => set("gender", v === NO_GENDER ? "" : v)}
            disabled={disabled}
          >
            <SelectTrigger id={`${uid}-gender`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_GENDER}>Chưa chọn</SelectItem>
              {Object.entries(GENDER_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {withIssuedOn && textField("id_issued_on", "Ngày cấp", { type: "date" })}
        {textField("address", "Nơi thường trú", { required: true, wide: true })}
      </div>
    </div>
  );
}

function ReadNotice({ outcome, isCccd }: { outcome: ReadOutcome; isCccd: boolean }) {
  if (outcome === "reading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang đọc thông tin trên ảnh…
      </p>
    );
  }
  if (outcome === "qr" || outcome === "ocr") {
    return (
      <InfoBox variant="success" className="flex items-start gap-2 text-sm">
        <QrCode className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Đã điền thông tin {outcome === "qr" ? "từ mã QR trên CCCD" : "đọc được trên ảnh"}. Vui lòng kiểm tra lại — ô bạn
          sửa sẽ được đánh dấu để tổ chức đấu giá đối chiếu.
        </span>
      </InfoBox>
    );
  }
  if (outcome === "failed") {
    return (
      <InfoBox variant="amber" className="text-sm">
        {isCccd
          ? "Không đọc được mã QR trên ảnh. Bạn có thể chụp lại mặt trước (đủ sáng, không loá, thẻ chiếm gần hết khung hình) hoặc tự nhập thông tin bên dưới."
          : "Vui lòng nhập thông tin đúng như trên trang thông tin hộ chiếu."}
      </InfoBox>
    );
  }
  return null;
}

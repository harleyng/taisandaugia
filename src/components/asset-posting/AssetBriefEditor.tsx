import { useEffect, useRef } from "react";
import { RefreshCw, Inbox } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildAssetBrief, type AssetBriefInput } from "@/lib/assetBrief";

interface AssetBriefEditorProps {
  /** Hồ sơ tài sản để sinh bản nháp. */
  input: AssetBriefInput;
  /**
   * Nơi nhận — hiện trong nhãn để người gửi biết mình đang viết cho ai. Một tên
   * tổ chức khi chọn một, hoặc "N tổ chức" khi gửi yêu cầu báo giá cho nhiều nơi.
   */
  recipientLabel?: string | null;
  value: string;
  onChange: (v: string) => void;
}

/** Giới hạn mềm: đủ cho một brief tử tế, chặn dán cả hợp đồng vào ô này. */
const MAX_LEN = 2000;

/**
 * Nội dung gửi vào hộp thư tổ chức đấu giá — sinh sẵn từ hồ sơ, sửa được.
 *
 * Ô này trước đây là một Textarea trống với placeholder "Mong muốn cụ thể của
 * bạn..." (và trong wizard thì KHÔNG TỒN TẠI — lời nhắn bị rơi âm thầm). Chủ tài
 * sản không biết tổ chức cần nghe gì, tổ chức nhận về một dòng cảm tính.
 *
 * Luật đồng bộ — chỗ dễ sai nhất của component này:
 *   · Giá khởi điểm, hình thức, mốc thời gian đều nằm NGAY TRÊN ô này trong cùng
 *     bước 4, nên `input` đổi liên tục khi người dùng còn đang chỉnh.
 *   · Khi người dùng CHƯA gõ gì → bản nháp tự cập nhật theo hồ sơ.
 *   · Khi người dùng ĐÃ gõ → không bao giờ ghi đè; chỉ mời "Tạo lại". Tự động
 *     hoá ở đây là xoá chữ của người khác.
 */
export function AssetBriefEditor({ input, recipientLabel, value, onChange }: AssetBriefEditorProps) {
  const draft = buildAssetBrief(input);

  // Đã rời khỏi bản nháp tự sinh? Một khi true thì không quay lại false: người
  // dùng xoá hết chữ để viết lại từ đầu cũng không đáng bị nhồi bản nháp trở lại.
  const touched = useRef(false);
  if (value && value !== draft) touched.current = true;

  useEffect(() => {
    if (!touched.current) onChange(draft);
  }, [draft, onChange]);

  const stale = touched.current && value.trim() !== draft.trim();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="asset-brief" className="flex items-center gap-1.5 text-sm">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
          {recipientLabel ? `Nội dung gửi ${recipientLabel}` : "Nội dung gửi tổ chức"}
        </Label>
        {stale && (
          <button
            type="button"
            onClick={() => {
              touched.current = false;
              onChange(draft);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary/5"
          >
            <RefreshCw className="h-3 w-3" /> Tạo lại bản mô tả tự động
          </button>
        )}
      </div>

      <Textarea
        id="asset-brief"
        value={value}
        maxLength={MAX_LEN}
        onChange={(e) => {
          touched.current = true;
          onChange(e.target.value);
        }}
        placeholder="Mô tả ngắn về tài sản và mong muốn của bạn..."
        className="min-h-[164px] text-[13.5px] leading-relaxed"
      />

      <p className="text-[11px] text-muted-foreground">
        Sàn đã soạn sẵn bản mô tả từ hồ sơ bạn vừa số hoá — sửa thoải mái trước khi gửi. Mọi tổ chức bạn chọn đều nhận
        cùng nội dung này và đọc nó trước khi mở hồ sơ đầy đủ.
      </p>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FieldHistoryPopover } from "./FieldHistoryPopover";
import { useEditOutreachField, useResetOutreachField } from "@/hooks/useSessionOutreach";
import { SMS_MAX, isSmsSafe } from "@/lib/outreach/sms";
import type { OutreachEdit, OutreachField } from "@/types/outreach";

interface Props {
  sessionId: string;
  packId: string | null;
  fieldKey: string;
  field: OutreachField | undefined;
  edits: OutreachEdit[];
  readOnly: boolean;
  rows?: number;
  placeholder?: string;
  sms?: boolean;
  /** Nút thao tác dùng GIÁ TRỊ ĐANG GÕ (kể cả chưa lưu). */
  renderActions?: (value: string) => ReactNode;
}

/**
 * Một trường sinh ra: sửa được, lưu khi rời ô (mỗi lần lưu = một dòng nhật ký),
 * trình soạn KHÔNG đè bản đã sửa tay — bản mới hiện thành đề xuất để người dùng chọn.
 */
export function OutreachFieldEditor({
  sessionId, packId, fieldKey, field, edits, readOnly, rows = 6, placeholder, sms, renderActions,
}: Props) {
  const edit = useEditOutreachField(sessionId);
  const reset = useResetOutreachField(sessionId);
  const [value, setValue] = useState(field?.value ?? "");
  const [showSuggestion, setShowSuggestion] = useState(false);

  useEffect(() => setValue(field?.value ?? ""), [field?.value]);

  const saved = field?.value ?? "";
  const dirty = value !== saved;
  const locked = readOnly || !packId;
  const suggestion =
    field?.origin === "edited" && field.generated_value != null && field.generated_value !== field.value
      ? field.generated_value
      : null;

  const save = () => {
    if (!dirty || locked || !packId) return;
    edit.mutate({ packId, key: fieldKey, value });
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        rows={rows}
        readOnly={locked}
        placeholder={placeholder ?? (locked ? "" : "Chưa có nội dung — bấm Soạn gói tiếp thị hoặc tự viết.")}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        className="font-[inherit] text-sm leading-relaxed"
      />

      {suggestion && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Trình soạn có bản mới — bản sửa tay của bạn đang được giữ.
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowSuggestion((v) => !v)}>
                {showSuggestion ? "Ẩn" : "Xem bản mới"}
              </Button>
              {!locked && packId && (
                <Button size="sm" variant="outline" disabled={reset.isPending} onClick={() => reset.mutate({ packId, key: fieldKey })}>
                  Dùng bản mới
                </Button>
              )}
            </div>
          </div>
          {showSuggestion && <p className="mt-2 whitespace-pre-line text-muted-foreground">{suggestion}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {field && (
            <Badge variant="outline" className="font-normal">
              {field.origin === "edited" ? "Đã sửa tay" : "Trình soạn tạo"}
            </Badge>
          )}
          {sms ? (
            <span className={value.length > SMS_MAX || !isSmsSafe(value) ? "text-destructive" : ""}>
              {value.length}/{SMS_MAX} ký tự{!isSmsSafe(value) ? " · có ký tự có dấu/đặc biệt" : ""}
            </span>
          ) : (
            <span>{value.length.toLocaleString("en-US")} ký tự</span>
          )}
          {edit.isPending && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Đang lưu…
            </span>
          )}
          {dirty && !edit.isPending && !locked && <span className="text-warning">Chưa lưu — rời ô để lưu</span>}
          <FieldHistoryPopover edits={edits} />
        </div>
        {renderActions && <div className="flex flex-wrap gap-2">{renderActions(value)}</div>}
      </div>
    </div>
  );
}

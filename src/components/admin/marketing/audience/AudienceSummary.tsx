import { useState } from "react";
import { Users, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveAudience } from "@/hooks/useCampaigns";
import { audiencePreviewHeadline, describeSpec } from "@/lib/marketing/audienceCriteria";
import {
  AudienceListDrawer,
  type AudienceListRow,
} from "./AudienceListDrawer";
import type { AudienceSpec } from "@/types/marketing";

const PREVIEW_CAP = 500;

interface Props {
  spec: AudienceSpec;
  count?: number;
  isFetching: boolean;
  isError: boolean;
}

export function AudienceSummary({ spec, count, isFetching, isError }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AudienceListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const chips = describeSpec(spec);
  const total = count ?? 0;
  const head = audiencePreviewHeadline(spec, { count, isFetching, isError });
  // AudienceSummary chỉ hiện cho loại "tiêu chí" → gợi ý cụ thể hơn khi chưa có bộ lọc.
  const primaryText =
    head.state === "empty" ? "Hãy thêm ít nhất 1 tiêu chí lọc" : head.primary;

  const openPreview = async () => {
    setOpen(true);
    setLoading(true);
    setError(false);
    try {
      setRows(await resolveAudience(spec, true, PREVIEW_CAP, 0));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Users className="h-5 w-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-semibold",
              head.state === "error" ? "text-destructive" : "text-foreground",
            )}
          >
            {primaryText}
          </p>
          <p className="text-xs text-muted-foreground">
            Chỉ gửi cho người dùng đã cho phép gửi email.
          </p>
        </div>
        {head.state === "ready" && total > 0 && (
          <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={openPreview}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Xem danh sách
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <span
              key={i}
              className="rounded-full bg-background border border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <AudienceListDrawer
        open={open}
        onOpenChange={setOpen}
        title="Đối tượng đủ điều kiện"
        total={total}
        rows={rows}
        loading={loading}
        error={error}
      />
    </div>
  );
}

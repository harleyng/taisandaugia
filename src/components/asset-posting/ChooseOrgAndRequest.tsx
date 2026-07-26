import { useState } from "react";
import { Loader2, Send, SearchX, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMatchedOrgs, useSendServiceRequest } from "@/hooks/useAssetPosting";
import type { MatchCriteria } from "@/lib/orgMatching";
import { OrgComparisonTable } from "./OrgComparisonTable";

interface ChooseOrgAndRequestProps {
  /** Hồ sơ tài sản ĐÃ số hoá cần gửi yêu cầu. */
  postingId: string;
  /** Tiêu chí gợi ý tổ chức. */
  criteria: MatchCriteria;
  /** Đã gửi yêu cầu thành công tới tổ chức. */
  onSent: (orgName: string) => void;
  /** Bỏ qua gửi yêu cầu (để sau). */
  onSkip: () => void;
  /** Nhãn nút bỏ qua (mặc định "Để sau"). */
  skipLabel?: string;
}

/**
 * Luồng RIÊNG: chọn tổ chức đấu giá + gửi yêu cầu dịch vụ cho một hồ sơ đã số hoá.
 * Tái sử dụng trong wizard (ngay sau khi số hoá) và ở trang chi tiết hồ sơ.
 */
export function ChooseOrgAndRequest({ postingId, criteria, onSent, onSkip, skipLabel = "Để sau" }: ChooseOrgAndRequestProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const { results, isLoading } = useMatchedOrgs(criteria);
  const send = useSendServiceRequest();

  const selected = results.find((r) => r.org.id === selectedId) ?? null;

  const handleSend = () => {
    if (!selected) return;
    send.mutate(
      {
        postingId,
        orgId: selected.org.id,
        matchScore: selected.score,
        message: message.trim() || undefined,
      },
      { onSuccess: () => onSent(selected.org.name) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
        <SearchX className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-xs">
          Chưa tìm thấy tổ chức đấu giá phù hợp trong hệ thống. Hồ sơ của bạn đã được số hoá — bạn có thể gửi yêu cầu sau.
        </p>
        <Button variant="outline" onClick={onSkip}>
          {skipLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/20 p-3">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          {results.length} tổ chức đấu giá phù hợp được xếp hạng theo chuyên môn, địa bàn, hình thức, kinh nghiệm và thù lao.
          Chọn một tổ chức để gửi yêu cầu dịch vụ.
        </p>
      </div>

      <OrgComparisonTable results={results} selectedId={selectedId} onSelect={setSelectedId} />

      {selectedId && (
        <div className="space-y-2">
          <Label htmlFor="request-message" className="text-sm">
            Lời nhắn gửi tổ chức (tùy chọn)
          </Label>
          <Textarea
            id="request-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mong muốn cụ thể của bạn về phiên đấu giá..."
            className="min-h-[72px]"
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row-reverse gap-3">
        <Button onClick={handleSend} disabled={!selectedId || send.isPending} className="flex-1 gap-2" size="lg">
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {send.isPending ? "Đang gửi yêu cầu..." : "Gửi yêu cầu dịch vụ"}
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={send.isPending} className="sm:flex-none" size="lg">
          {skipLabel}
        </Button>
      </div>
    </div>
  );
}
